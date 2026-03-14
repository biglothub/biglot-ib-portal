<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { formatPercent, formatNumber } from '$lib/utils';

	let { data } = $props();
	let goals = $derived(data.goals || []);
	let snapshot = $derived(data.snapshot || []);
	let journalSummary = $derived(data.journalSummary);
	let reviewSummary = $derived(data.reviewSummary);
	let actionError = $state('');

	async function saveGoal(goalType: string, targetValue: number, periodDays: number) {
		actionError = '';

		try {
			const res = await fetch('/api/portfolio/progress', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					goal_type: goalType,
					target_value: targetValue,
					period_days: periodDays
				})
			});
			if (!res.ok) {
				actionError = 'ไม่สามารถบันทึกเป้าหมายได้';
				return;
			}
			invalidate('portfolio:baseData');
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		}
	}
</script>

<div class="space-y-6">
	{#if actionError}
		<div class="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center justify-between">
			<span>{actionError}</span>
			<button type="button" onclick={() => actionError = ''} class="text-red-300 hover:text-red-200 text-xs">ปิด</button>
		</div>
	{/if}

	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="card">
			<div class="text-xs text-gray-500">Review Rate</div>
			<div class="mt-1 text-2xl font-semibold text-white">{(reviewSummary?.reviewRate || 0).toFixed(0)}%</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Reviewed Trades</div>
			<div class="mt-1 text-2xl font-semibold text-white">{reviewSummary?.reviewed || 0}</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Journal Completion</div>
			<div class="mt-1 text-2xl font-semibold text-green-400">{(journalSummary?.completionRate || 0).toFixed(0)}%</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Journal Streak</div>
			<div class="mt-1 text-2xl font-semibold text-white">{journalSummary?.currentStreak || 0}</div>
		</div>
	</div>

	<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
		{#each snapshot as goal}
			<div class="card space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-white">{goal.goal_type}</h2>
						<p class="text-xs text-gray-500">Period: {goal.period_days} days</p>
					</div>
					<div class="text-right">
						<div class="text-lg font-semibold text-white">{goal.currentValue.toFixed(1)}</div>
						<div class="text-xs text-gray-500">target {goal.target_value}</div>
					</div>
				</div>
				<div class="w-full bg-dark-border rounded-full h-2">
					<div class="bg-brand-primary rounded-full h-2" style={`width:${goal.progress}%`}></div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<input
						type="number"
						value={goal.target_value}
						onchange={(event) => saveGoal(goal.goal_type, Number((event.currentTarget as HTMLInputElement).value), goal.period_days)}
						class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
					/>
					<input
						type="number"
						value={goal.period_days}
						onchange={(event) => saveGoal(goal.goal_type, goal.target_value, Number((event.currentTarget as HTMLInputElement).value))}
						class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
					/>
				</div>
				<div class="text-xs text-gray-500">
					{goal.goal_type === 'review_completion' && `Current review rate ${formatPercent(goal.currentValue).replace('+', '')}`}
					{goal.goal_type === 'journal_streak' && `Current streak ${formatNumber(goal.currentValue, 0)} days`}
					{goal.goal_type === 'max_rule_breaks' && `Current rule breaks ${formatNumber(goal.currentValue, 0)}`}
					{goal.goal_type === 'profit_factor' && `Current PF ${formatNumber(goal.currentValue)}`}
					{goal.goal_type === 'win_rate' && `Current win rate ${formatPercent(goal.currentValue).replace('+', '')}`}
				</div>
			</div>
		{/each}
	</div>
</div>
