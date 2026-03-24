<script lang="ts">
	import AnalyticsDashboard from '$lib/components/portfolio/AnalyticsDashboard.svelte';
	import StatsOverviewTable from '$lib/components/reports/StatsOverviewTable.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatPercent, formatNumber } from '$lib/utils';
	import type { StatsSection } from '$lib/types';

	let { report, statsOverview } = $props<{
		report: Record<string, unknown>;
		statsOverview: StatsSection[] | null | undefined;
	}>();
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
	<div class="card border-l-2 {report.expectancy >= 0 ? 'border-l-green-500' : 'border-l-red-500'}">
		<div class="text-xs text-gray-400 uppercase tracking-wider">ค่าคาดหวัง</div>
		<div class="mt-1.5 text-2xl font-bold {report.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">
			{formatCurrency(report.expectancy)}
		</div>
	</div>
	<div class="card border-l-2 border-l-red-500">
		<div class="text-xs text-gray-400 uppercase tracking-wider">ต้นทุนผิดกฎ</div>
		<div class="mt-1.5 text-2xl font-bold text-red-400">{formatCurrency(report.ruleBreakMetrics?.ruleBreakLoss || 0)}</div>
	</div>
	<div class="card border-l-2 border-l-green-500">
		<div class="text-xs text-gray-400 uppercase tracking-wider">บันทึกครบ</div>
		<div class="mt-1.5 text-2xl font-bold text-green-400">{(report.journalSummary?.completionRate || 0).toFixed(0)}%</div>
	</div>
	<div class="card border-l-2 border-l-brand-primary">
		<div class="text-xs text-gray-400 uppercase tracking-wider">เทรดที่กรอง</div>
		<div class="mt-1.5 text-2xl font-bold text-white">{report.filteredTrades?.length || 0}</div>
	</div>
</div>

{#if statsOverview && statsOverview.length > 0}
	<div class="card">
		<h2 class="text-base font-semibold text-white mb-4">สถิติของคุณ</h2>
		<StatsOverviewTable sections={statsOverview} />
	</div>
{/if}

{#if report.analytics}
	<AnalyticsDashboard analytics={report.analytics} />
{/if}

<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
	<div class="card">
		<h2 class="text-sm font-semibold text-gray-300 mb-4">ผลลัพธ์ตาม Setup / Playbook</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-400 text-[11px] uppercase tracking-wider">
						<th class="text-left py-2.5 font-medium">กลยุทธ์</th>
						<th class="text-right py-2.5 font-medium">เทรด</th>
						<th class="text-right py-2.5 font-medium">อัตราชนะ</th>
						<th class="text-right py-2.5 font-medium">PF</th>
						<th class="text-right py-2.5 font-medium">ค่าคาดหวัง</th>
						<th class="text-right py-2.5 font-medium">กำไร/ขาดทุน</th>
					</tr>
				</thead>
				<tbody>
					{#each report.setupPerformance || [] as setup}
						<tr class="border-b border-dark-border/30 hover:bg-dark-bg/30 transition-colors">
							<td class="py-2.5 text-white font-medium">{setup.name}</td>
							<td class="py-2.5 text-right text-gray-300">{setup.totalTrades}</td>
							<td class="py-2.5 text-right {setup.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{formatPercent(setup.winRate).replace('+', '')}</td>
							<td class="py-2.5 text-right {setup.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{setup.profitFactor === Infinity ? '∞' : formatNumber(setup.profitFactor)}</td>
							<td class="py-2.5 text-right {setup.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.expectancy)}</td>
							<td class="py-2.5 text-right font-semibold {setup.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.totalProfit)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<div class="card">
		<h2 class="text-sm font-semibold text-gray-300 mb-4">แยกตามเซสชัน</h2>
		<div class="space-y-3">
			{#each report.sessionStats || [] as session}
				<div class="rounded-xl bg-dark-bg/30 px-4 py-3">
					<div class="flex items-center justify-between">
						<span class="text-white uppercase">{session.session}</span>
						<span class="{session.profit >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">{formatCurrency(session.profit)}</span>
					</div>
					<div class="mt-1 text-xs text-gray-400">{session.trades} เทรด • ชนะ {session.winRate.toFixed(0)}%</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
	<div class="card xl:col-span-1">
		<h2 class="text-sm font-semibold text-gray-300 mb-4">ต้นทุนจากข้อผิดพลาด</h2>
		<div class="space-y-2">
			{#if report.mistakeStats?.length > 0}
				{#each report.mistakeStats.slice(0, 8) as mistake}
					<div class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3">
						<div>
							<div class="text-sm text-white">{mistake.name}</div>
							<div class="text-[11px] text-gray-400">{mistake.count} เทรดที่ติดแท็ก</div>
						</div>
						<div class="text-sm font-medium text-red-400">{formatCurrency(mistake.cost)}</div>
					</div>
				{/each}
			{:else}
				<EmptyState message="ยังไม่มีแท็กข้อผิดพลาดในเทรดที่กรอง" />
			{/if}
		</div>
	</div>
	<div class="card xl:col-span-1">
		<h2 class="text-sm font-semibold text-gray-300 mb-4">แยกตามระยะเวลาถือ</h2>
		<div class="space-y-2">
			{#each report.durationBuckets || [] as bucket}
				<div class="rounded-xl bg-dark-bg/30 px-3 py-3">
					<div class="flex items-center justify-between">
						<div class="text-sm text-white uppercase">{bucket.bucket}</div>
						<div class="{bucket.profit >= 0 ? 'text-green-400' : 'text-red-400'} text-sm font-medium">{formatCurrency(bucket.profit)}</div>
					</div>
					<div class="mt-1 text-[11px] text-gray-400">{bucket.count} เทรด • เฉลี่ย {bucket.avgMinutes} นาที</div>
				</div>
			{/each}
		</div>
	</div>
	<div class="card xl:col-span-1">
		<h2 class="text-sm font-semibold text-gray-300 mb-4">เป้าหมายความคืบหน้า</h2>
		<div class="space-y-3">
			{#each report.progressSnapshot || [] as goal}
				<div>
					<div class="flex items-center justify-between text-xs mb-1">
						<span class="text-gray-400">{goal.goal_type}</span>
						<span class="text-white">{goal.currentValue.toFixed(1)} / {goal.target_value}</span>
					</div>
					<div class="w-full bg-dark-border rounded-full h-2">
						<div class="bg-brand-primary rounded-full h-2" style={`width: ${goal.progress}%`}></div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
