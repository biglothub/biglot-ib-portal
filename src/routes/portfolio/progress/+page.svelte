<script lang="ts">
	import { invalidate } from '$app/navigation';
	import DailyChecklist from '$lib/components/portfolio/DailyChecklist.svelte';
	import ProgressHeatmap from '$lib/components/portfolio/ProgressHeatmap.svelte';
	import RulesAnalyticsTable from '$lib/components/portfolio/RulesAnalyticsTable.svelte';

	let { data } = $props();
	let checklistRules = $derived(data.checklistRules || []);
	let checklistCompletions = $derived(data.checklistCompletions || []);
	let checklistStreak = $derived(data.checklistStreak || 0);
	let heatmapData = $derived(data.heatmapData || []);
	let rulesAnalytics = $derived(data.rulesAnalytics || []);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-lg font-semibold text-white">วินัยการเทรด</h1>
		{#if checklistStreak > 0}
			<div class="flex items-center gap-1.5 text-sm">
				<span class="text-brand-primary font-bold">{checklistStreak}</span>
				<span class="text-gray-400">วันติดต่อกัน</span>
			</div>
		{/if}
	</div>

	<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
		<div class="card">
			<ProgressHeatmap data={heatmapData} streak={checklistStreak} />
		</div>
		<div class="card">
			<DailyChecklist
				rules={checklistRules}
				completions={checklistCompletions}
				onupdate={() => invalidate('portfolio:baseData')}
			/>
		</div>
	</div>

	{#if rulesAnalytics.length > 0}
		<div class="card">
			<RulesAnalyticsTable analytics={rulesAnalytics} />
		</div>
	{/if}
</div>
