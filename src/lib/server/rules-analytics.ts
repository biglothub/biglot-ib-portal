interface ChecklistRule {
	id: string;
	name: string;
	type: string;
	condition?: Record<string, unknown>;
	automated_check?: string;
}

interface Completion {
	rule_id: string;
	date: string;
	completed: boolean;
}

interface DailyEntry {
	date: string;
	profit: number;
}

interface RuleAnalytics {
	ruleId: string;
	name: string;
	condition: string;
	streak: number;
	avgPerfFollowed: number;
	avgPerfNotFollowed: number;
	followRate: number;
	followedDays: number;
	totalDays: number;
}

/**
 * Build per-rule analytics: streak, avg performance, follow rate
 */
export function buildRulesAnalytics(
	rules: ChecklistRule[],
	completions: Completion[],
	dailyHistory: DailyEntry[]
): RuleAnalytics[] {
	const dailyPnlMap = new Map<string, number>();
	for (const d of dailyHistory) {
		dailyPnlMap.set(d.date, d.profit);
	}

	const tradingDates = new Set(dailyHistory.map(d => d.date));
	const totalTradingDays = tradingDates.size;

	return rules.map(rule => {
		// Get this rule's completions
		const ruleCompletions = completions.filter(c => c.rule_id === rule.id);
		const completedDates = new Set(ruleCompletions.filter(c => c.completed).map(c => c.date));
		const followedDays = completedDates.size;

		// Follow rate
		const followRate = totalTradingDays > 0 ? (followedDays / totalTradingDays) * 100 : 0;

		// Streak (consecutive days completed, counting backwards from most recent)
		const sortedDates = [...completedDates].sort().reverse();
		let streak = 0;
		if (sortedDates.length > 0) {
			let prevDate = new Date(sortedDates[0] + 'T00:00:00');
			streak = 1;
			for (let i = 1; i < sortedDates.length; i++) {
				const curDate = new Date(sortedDates[i] + 'T00:00:00');
				const diffDays = Math.round((prevDate.getTime() - curDate.getTime()) / 86400000);
				if (diffDays === 1) { streak++; prevDate = curDate; }
				else break;
			}
		}

		// Avg performance on followed vs not followed days
		let followedPnl = 0, followedCount = 0;
		let notFollowedPnl = 0, notFollowedCount = 0;

		for (const date of tradingDates) {
			const pnl = dailyPnlMap.get(date) || 0;
			if (completedDates.has(date)) {
				followedPnl += pnl;
				followedCount++;
			} else {
				notFollowedPnl += pnl;
				notFollowedCount++;
			}
		}

		const avgPerfFollowed = followedCount > 0 ? followedPnl / followedCount : 0;
		const avgPerfNotFollowed = notFollowedCount > 0 ? notFollowedPnl / notFollowedCount : 0;

		// Condition display string
		const condition = formatCondition(rule);

		return {
			ruleId: rule.id,
			name: rule.name,
			condition,
			streak,
			avgPerfFollowed,
			avgPerfNotFollowed,
			followRate,
			followedDays,
			totalDays: totalTradingDays
		};
	});
}

function formatCondition(rule: ChecklistRule): string {
	if (rule.type === 'manual') return 'ทำเอง';
	const cond = rule.condition || {};
	if ((cond as any).unit === 'percent') return `${(cond as any).threshold || 100}%`;
	if ((cond as any).unit === 'usd') return `< $${(cond as any).max || 100}`;
	if (rule.automated_check === 'journal_complete') return 'ครบถ้วน';
	return rule.automated_check || 'อัตโนมัติ';
}
