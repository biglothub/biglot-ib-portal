import type { Trade } from '$lib/types';

interface ChecklistRule {
	id: string;
	name: string;
	type: 'manual' | 'automated';
	automated_check?: string;
	condition?: Record<string, unknown>;
	is_active: boolean;
}

interface ChecklistCompletion {
	rule_id: string;
	date: string;
	completed: boolean;
	auto_value?: number;
}

interface DailyJournalEntry {
	date: string;
	completion_status: string;
}

/**
 * Evaluate automated checklist rules for a given date
 */
export function evaluateAutomatedRules(
	rules: ChecklistRule[],
	trades: Trade[],
	journals: DailyJournalEntry[],
	date: string
): Map<string, { completed: boolean; value: number }> {
	const results = new Map<string, { completed: boolean; value: number }>();

	const dayTrades = trades.filter(t => {
		const d = t.close_time?.split('T')[0];
		return d === date;
	});

	for (const rule of rules) {
		if (rule.type !== 'automated' || !rule.is_active) continue;

		const result = evaluateSingleRule(rule, dayTrades, journals, date);
		results.set(rule.id, result);
	}

	return results;
}

function evaluateSingleRule(
	rule: ChecklistRule,
	dayTrades: Trade[],
	journals: DailyJournalEntry[],
	date: string
): { completed: boolean; value: number } {
	switch (rule.automated_check) {
		case 'trades_have_sl': {
			if (dayTrades.length === 0) return { completed: true, value: 100 };
			const withSl = dayTrades.filter(t => t.sl && Number(t.sl) > 0).length;
			const pct = (withSl / dayTrades.length) * 100;
			const threshold = (rule.condition as any)?.threshold ?? 100;
			return { completed: pct >= threshold, value: Math.round(pct) };
		}

		case 'journal_complete': {
			const journal = journals.find(j => j.date === date);
			const completed = journal?.completion_status === 'complete';
			return { completed, value: completed ? 100 : 0 };
		}

		case 'max_loss_trade': {
			if (dayTrades.length === 0) return { completed: true, value: 0 };
			const maxLoss = dayTrades.reduce((min, t) => { const v = Number(t.profit || 0); return v < min ? v : min; }, Infinity);
			const limit = (rule.condition as any)?.max ?? 100;
			const absLoss = Math.abs(Math.min(maxLoss, 0));
			return { completed: absLoss <= limit, value: absLoss };
		}

		case 'max_loss_day': {
			if (dayTrades.length === 0) return { completed: true, value: 0 };
			const dayPnl = dayTrades.reduce((s, t) => s + Number(t.profit || 0), 0);
			const limit = (rule.condition as any)?.max ?? 500;
			const absLoss = Math.abs(Math.min(dayPnl, 0));
			return { completed: absLoss <= limit, value: absLoss };
		}

		case 'trades_linked_playbook': {
			if (dayTrades.length === 0) return { completed: true, value: 100 };
			const linked = dayTrades.filter(t => {
				const tr = (t as any).trade_reviews;
				const r = !tr ? null : Array.isArray(tr) ? tr[0] : tr;
				return r?.playbook_id != null;
			}).length;
			const pct = (linked / dayTrades.length) * 100;
			const threshold = (rule.condition as any)?.threshold ?? 100;
			return { completed: pct >= threshold, value: Math.round(pct) };
		}

		default:
			return { completed: false, value: 0 };
	}
}

/**
 * Get default checklist rules for a new user
 */
export function getDefaultRules(): Array<Omit<ChecklistRule, 'id'> & { name: string; type: 'manual' | 'automated'; automated_check?: string; condition?: Record<string, unknown> }> {
	return [
		{
			name: 'ตรวจสอบโครงสร้างตลาด',
			type: 'manual',
			is_active: true
		},
		{
			name: 'กำหนดขีดจำกัดขาดทุนรายวัน',
			type: 'manual',
			is_active: true
		},
		{
			name: 'ทุกเทรดมี Stop Loss',
			type: 'automated',
			automated_check: 'trades_have_sl',
			condition: { threshold: 100, unit: 'percent' },
			is_active: true
		},
		{
			name: 'เขียน Journal แล้ว',
			type: 'automated',
			automated_check: 'journal_complete',
			condition: {},
			is_active: true
		},
		{
			name: 'ขาดทุนต่อเทรด < $100',
			type: 'automated',
			automated_check: 'max_loss_trade',
			condition: { max: 100, unit: 'usd' },
			is_active: true
		}
	];
}

/**
 * Calculate checklist streak (consecutive days with 100% completion)
 */
export function calculateChecklistStreak(
	completions: ChecklistCompletion[],
	rules: ChecklistRule[]
): number {
	if (completions.length === 0 || rules.length === 0) return 0;

	const activeRuleIds = new Set(rules.filter(r => r.is_active).map(r => r.id));
	const activeCount = activeRuleIds.size;
	if (activeCount === 0) return 0;

	// Group completions by date
	const byDate = new Map<string, number>();
	for (const c of completions) {
		if (!activeRuleIds.has(c.rule_id)) continue;
		if (!c.completed) continue;
		byDate.set(c.date, (byDate.get(c.date) || 0) + 1);
	}

	// Sort dates descending
	const dates = [...byDate.keys()].sort().reverse();
	let streak = 0;

	for (const date of dates) {
		const completedCount = byDate.get(date) || 0;
		if (completedCount >= activeCount) {
			streak++;
		} else {
			break;
		}
	}

	return streak;
}

/**
 * Build heatmap data: completion rate per day over the last N weeks
 */
export function buildChecklistHeatmap(
	completions: ChecklistCompletion[],
	rules: ChecklistRule[],
	weeks: number = 12
): Array<{ date: string; rate: number; day: number }> {
	const activeRuleIds = new Set(rules.filter(r => r.is_active).map(r => r.id));
	const activeCount = activeRuleIds.size;
	if (activeCount === 0) return [];

	// Group completions by date
	const byDate = new Map<string, number>();
	for (const c of completions) {
		if (!activeRuleIds.has(c.rule_id)) continue;
		if (!c.completed) continue;
		byDate.set(c.date, (byDate.get(c.date) || 0) + 1);
	}

	// Generate grid for last N weeks
	const today = new Date();
	const result: Array<{ date: string; rate: number; day: number }> = [];

	for (let i = weeks * 7 - 1; i >= 0; i--) {
		const d = new Date(today);
		d.setDate(d.getDate() - i);
		const dateStr = d.toISOString().split('T')[0];
		const completedCount = byDate.get(dateStr) || 0;
		const rate = activeCount > 0 ? (completedCount / activeCount) * 100 : 0;
		result.push({ date: dateStr, rate, day: d.getDay() });
	}

	return result;
}
