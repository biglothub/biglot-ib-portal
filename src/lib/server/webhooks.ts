/**
 * Webhook delivery service
 *
 * Sends notifications to LINE Notify and Discord webhooks.
 * LINE messages are in Thai; Discord messages are in English with rich embeds.
 * All sends: 5 s timeout, no retry, silent fail on error.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trade } from '$lib/types';

export type WebhookType = 'line' | 'discord';
export type WebhookEvent = 'trade_sync' | 'daily_pnl' | 'rule_break';

export interface WebhookConfig {
	id: string;
	user_id: string;
	webhook_type: WebhookType;
	webhook_url: string;
	events: WebhookEvent[];
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

// ─── Color constants for Discord embeds ──────────────────────────────────────
const DISCORD_COLOR_GREEN = 3066993;
const DISCORD_COLOR_RED = 15158332;
const DISCORD_COLOR_BLUE = 3447003;
const DISCORD_COLOR_ORANGE = 15105570;

// ─── Low-level send ──────────────────────────────────────────────────────────

async function post(url: string, body: object): Promise<void> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5_000);
	try {
		await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		});
	} catch {
		// Silent fail — webhook errors must never affect the main flow
	} finally {
		clearTimeout(timer);
	}
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtThaiDate(dateStr: string): string {
	const thaiMonths = [
		'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
		'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
	];
	const d = new Date(dateStr);
	const buddhistYear = d.getFullYear() + 543;
	return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${buddhistYear}`;
}

function fmtCurrency(amount: number): string {
	const prefix = amount >= 0 ? '+' : '';
	return `${prefix}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

// ─── LINE message builders ────────────────────────────────────────────────────

function buildLineTradeSync(trades: Trade[]): string {
	const wins = trades.filter((t) => t.profit > 0).length;
	const totalPnl = trades.reduce((s, t) => s + t.profit, 0);
	const sign = totalPnl >= 0 ? '+' : '';
	return [
		'🔄 ซิงค์ข้อมูลการเทรด',
		`จำนวนเทรด: ${trades.length} รายการ`,
		`ชนะ: ${wins} / แพ้: ${trades.length - wins}`,
		`P&L รวม: ${sign}$${Math.abs(totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
	].join('\n');
}

function buildLineDailyPnl(date: string, pnl: number, winRate: number): string {
	const sign = pnl >= 0 ? '+' : '';
	return [
		'📊 สรุปผลประจำวัน',
		`วันที่: ${fmtThaiDate(date)}`,
		`P&L: ${sign}$${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
		`อัตราชนะ: ${Math.round(winRate * 100)}%`
	].join('\n');
}

function buildLineRuleBreak(tradeId: number, rules: string[]): string {
	const ruleList = rules.map((r) => `  • ${r}`).join('\n');
	return [
		'⚠️ ตรวจพบการละเมิดกฎ',
		`Trade #${tradeId}`,
		`กฎที่ละเมิด:\n${ruleList}`
	].join('\n');
}

// ─── Discord embed builders ───────────────────────────────────────────────────

function buildDiscordTradeSync(trades: Trade[]): object {
	const wins = trades.filter((t) => t.profit > 0).length;
	const totalPnl = trades.reduce((s, t) => s + t.profit, 0);
	return {
		embeds: [
			{
				title: 'Trade Sync Complete',
				color: totalPnl >= 0 ? DISCORD_COLOR_GREEN : DISCORD_COLOR_RED,
				fields: [
					{ name: 'Trades', value: String(trades.length), inline: true },
					{ name: 'Wins / Losses', value: `${wins} / ${trades.length - wins}`, inline: true },
					{ name: 'Net P&L', value: fmtCurrency(totalPnl), inline: true }
				],
				timestamp: new Date().toISOString()
			}
		]
	};
}

function buildDiscordDailyPnl(date: string, pnl: number, winRate: number): object {
	return {
		embeds: [
			{
				title: 'Daily P&L Summary',
				color: pnl >= 0 ? DISCORD_COLOR_GREEN : DISCORD_COLOR_RED,
				fields: [
					{ name: 'Date', value: date, inline: true },
					{ name: 'P&L', value: fmtCurrency(pnl), inline: true },
					{ name: 'Win Rate', value: fmtPercent(winRate), inline: true }
				],
				timestamp: new Date().toISOString()
			}
		]
	};
}

function buildDiscordRuleBreak(tradeId: number, rules: string[]): object {
	return {
		embeds: [
			{
				title: 'Rule Break Detected',
				color: DISCORD_COLOR_ORANGE,
				fields: [
					{ name: 'Trade', value: `#${tradeId}`, inline: true },
					{ name: 'Rules Broken', value: rules.join('\n') || '-', inline: false }
				],
				timestamp: new Date().toISOString()
			}
		]
	};
}

function buildDiscordTest(): object {
	return {
		embeds: [
			{
				title: 'Webhook Test',
				description: 'Your IB-Portal webhook is configured correctly.',
				color: DISCORD_COLOR_BLUE,
				timestamp: new Date().toISOString()
			}
		]
	};
}

// ─── Core send ────────────────────────────────────────────────────────────────

export async function sendWebhook(
	config: WebhookConfig,
	event: WebhookEvent,
	payload: object
): Promise<void> {
	if (!config.is_active) return;
	if (!config.events.includes(event)) return;

	if (config.webhook_type === 'line') {
		const text = (payload as { text: string }).text;
		await post(config.webhook_url, { message: { type: 'text', text } });
	} else {
		await post(config.webhook_url, payload);
	}
}

// ─── High-level event helpers ─────────────────────────────────────────────────

async function loadConfigs(
	supabase: SupabaseClient,
	userId: string,
	event: WebhookEvent
): Promise<WebhookConfig[]> {
	const { data } = await supabase
		.from('webhook_configs')
		.select('*')
		.eq('user_id', userId)
		.eq('is_active', true)
		.contains('events', [event]);

	return (data ?? []) as WebhookConfig[];
}

export async function sendTradeSync(
	supabase: SupabaseClient,
	userId: string,
	trades: Trade[]
): Promise<void> {
	if (trades.length === 0) return;
	const configs = await loadConfigs(supabase, userId, 'trade_sync');
	await Promise.all(
		configs.map((cfg) => {
			if (cfg.webhook_type === 'line') {
				return sendWebhook(cfg, 'trade_sync', { text: buildLineTradeSync(trades) });
			}
			return sendWebhook(cfg, 'trade_sync', buildDiscordTradeSync(trades));
		})
	);
}

export async function sendDailyPnl(
	supabase: SupabaseClient,
	userId: string,
	date: string,
	pnl: number,
	winRate: number
): Promise<void> {
	const configs = await loadConfigs(supabase, userId, 'daily_pnl');
	await Promise.all(
		configs.map((cfg) => {
			if (cfg.webhook_type === 'line') {
				return sendWebhook(cfg, 'daily_pnl', { text: buildLineDailyPnl(date, pnl, winRate) });
			}
			return sendWebhook(cfg, 'daily_pnl', buildDiscordDailyPnl(date, pnl, winRate));
		})
	);
}

export async function sendRuleBreak(
	supabase: SupabaseClient,
	userId: string,
	tradeId: number,
	rules: string[]
): Promise<void> {
	if (rules.length === 0) return;
	const configs = await loadConfigs(supabase, userId, 'rule_break');
	await Promise.all(
		configs.map((cfg) => {
			if (cfg.webhook_type === 'line') {
				return sendWebhook(cfg, 'rule_break', { text: buildLineRuleBreak(tradeId, rules) });
			}
			return sendWebhook(cfg, 'rule_break', buildDiscordRuleBreak(tradeId, rules));
		})
	);
}

// ─── Test send ────────────────────────────────────────────────────────────────

export async function sendTestWebhook(config: WebhookConfig): Promise<void> {
	if (config.webhook_type === 'line') {
		await post(config.webhook_url, {
			message: { type: 'text', text: '✅ ทดสอบ Webhook สำเร็จ\nระบบ IB-Portal เชื่อมต่อเรียบร้อยแล้ว' }
		});
	} else {
		await post(config.webhook_url, buildDiscordTest());
	}
}
