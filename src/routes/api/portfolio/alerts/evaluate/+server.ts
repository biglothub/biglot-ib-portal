import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { sendPushToUser } from '$lib/server/push';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AlertType } from '../+server';

interface AlertRow {
	id: string;
	alert_type: AlertType;
	threshold: number;
	last_triggered_at: string | null;
}

function wasTriggeredRecently(lastTriggered: string | null, cooldownMs = 3_600_000): boolean {
	if (!lastTriggered) return false;
	return Date.now() - new Date(lastTriggered).getTime() < cooldownMs;
}

export const POST: RequestHandler = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ triggered: 0, reason: 'no_account' });
	}

	// Fetch enabled alerts
	const { data: alerts } = await locals.supabase
		.from('performance_alerts')
		.select('id, alert_type, threshold, last_triggered_at')
		.eq('user_id', profile.id)
		.eq('enabled', true);

	if (!alerts?.length) {
		return json({ triggered: 0 });
	}

	// Fetch today's daily stats
	const today = new Date().toISOString().split('T')[0];
	const { data: todayStats } = await locals.supabase
		.from('daily_stats')
		.select('profit, balance, equity, win_rate, max_drawdown')
		.eq('client_account_id', account.id)
		.eq('date', today)
		.maybeSingle();

	// Fetch last 30 days of trades for win_rate and loss streak
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const { data: recentTrades } = await locals.supabase
		.from('trades')
		.select('profit, close_time')
		.eq('client_account_id', account.id)
		.gte('close_time', thirtyDaysAgo.toISOString())
		.order('close_time', { ascending: false });

	const trades = recentTrades ?? [];

	// Win rate (30d)
	const winRate30d =
		trades.length > 0
			? (trades.filter((t) => (t.profit ?? 0) > 0).length / trades.length) * 100
			: null;

	// Current loss streak (consecutive losses from most recent)
	let lossStreak = 0;
	for (const t of trades) {
		if ((t.profit ?? 0) < 0) lossStreak++;
		else break;
	}

	// Max drawdown from last 90 days of daily stats
	const { data: allStats } = await locals.supabase
		.from('daily_stats')
		.select('equity, balance')
		.eq('client_account_id', account.id)
		.order('date', { ascending: false })
		.limit(90);

	let maxDrawdownPct = 0;
	if (allStats && allStats.length > 0) {
		let peak = 0;
		for (const s of [...allStats].reverse()) {
			const eq = s.equity ?? s.balance ?? 0;
			if (eq > peak) peak = eq;
			if (peak > 0) {
				const dd = ((peak - eq) / peak) * 100;
				if (dd > maxDrawdownPct) maxDrawdownPct = dd;
			}
		}
	}

	const triggered: string[] = [];

	for (const alert of alerts as AlertRow[]) {
		if (wasTriggeredRecently(alert.last_triggered_at)) continue;

		let shouldTrigger = false;
		let notifTitle = '';
		let notifBody = '';

		switch (alert.alert_type) {
			case 'daily_loss': {
				const dailyProfit = todayStats?.profit ?? null;
				if (dailyProfit !== null && dailyProfit < 0 && Math.abs(dailyProfit) >= alert.threshold) {
					shouldTrigger = true;
					notifTitle = 'แจ้งเตือน: ขาดทุนรายวัน';
					notifBody = `ขาดทุนวันนี้ $${Math.abs(dailyProfit).toFixed(2)} เกินเกณฑ์ $${alert.threshold.toFixed(2)}`;
				}
				break;
			}
			case 'daily_profit_target': {
				const dailyProfit = todayStats?.profit ?? null;
				if (dailyProfit !== null && dailyProfit >= alert.threshold) {
					shouldTrigger = true;
					notifTitle = 'แจ้งเตือน: ถึงเป้าหมายกำไรรายวัน';
					notifBody = `กำไรวันนี้ $${dailyProfit.toFixed(2)} ถึงเป้า $${alert.threshold.toFixed(2)} แล้ว!`;
				}
				break;
			}
			case 'win_rate_drop': {
				if (winRate30d !== null && winRate30d < alert.threshold) {
					shouldTrigger = true;
					notifTitle = 'แจ้งเตือน: Win Rate ลดลง';
					notifBody = `Win Rate 30 วันล่าสุดอยู่ที่ ${winRate30d.toFixed(1)}% ต่ำกว่าเกณฑ์ ${alert.threshold}%`;
				}
				break;
			}
			case 'drawdown': {
				if (maxDrawdownPct >= alert.threshold) {
					shouldTrigger = true;
					notifTitle = 'แจ้งเตือน: Drawdown สูง';
					notifBody = `Max Drawdown อยู่ที่ ${maxDrawdownPct.toFixed(1)}% เกินเกณฑ์ ${alert.threshold}%`;
				}
				break;
			}
			case 'loss_streak': {
				if (lossStreak >= alert.threshold) {
					shouldTrigger = true;
					notifTitle = 'แจ้งเตือน: แพ้ติดต่อกัน';
					notifBody = `ขาดทุนติดต่อกัน ${lossStreak} ไม้ เกินเกณฑ์ ${alert.threshold} ไม้`;
				}
				break;
			}
		}

		if (shouldTrigger) {
			triggered.push(alert.id);
			await sendPushToUser(
				locals.supabase,
				profile.id,
				notifTitle,
				notifBody,
				'/portfolio/analytics'
			);
			await locals.supabase
				.from('performance_alerts')
				.update({ last_triggered_at: new Date().toISOString() })
				.eq('id', alert.id);
		}
	}

	return json({ triggered: triggered.length, ids: triggered });
};
