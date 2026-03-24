<script lang="ts">
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';
	import type { DayOfWeekReport, DayOfWeekItem } from '$lib/types';

	let { dayOfWeekReport } = $props<{
		dayOfWeekReport: DayOfWeekReport | null | undefined;
	}>();

	let daySort = $state<{ key: string; asc: boolean }>({ key: 'dayIdx', asc: true });

	const sortedDays = $derived.by(() => {
		const arr = [...(dayOfWeekReport?.days || [])];
		arr.sort((a: DayOfWeekItem, b: DayOfWeekItem) => {
			const va = (a as unknown as Record<string, number>)[daySort.key] ?? 0;
			const vb = (b as unknown as Record<string, number>)[daySort.key] ?? 0;
			return daySort.asc ? va - vb : vb - va;
		});
		return arr;
	});

	function toggleDaySort(key: string) {
		if (daySort.key === key) daySort = { key, asc: !daySort.asc };
		else daySort = { key, asc: false };
	}

	function formatHoldTime(minutes: number): string {
		if (minutes < 60) return `${minutes}m`;
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}
</script>

<!-- DAY OF WEEK REPORT -->
<div class="card">
	<h2 class="text-lg font-semibold text-white mb-4">ผลลัพธ์ตามวันในสัปดาห์</h2>

	{#if !dayOfWeekReport || dayOfWeekReport.days.length === 0}
		<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์รายวัน" />
	{:else}
		<!-- Best / Worst Day -->
		<div class="grid grid-cols-2 gap-4 mb-6">
			<div class="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
				<div class="text-xs text-green-400/70">วันที่ดีที่สุด</div>
				<div class="text-2xl font-bold text-green-400 mt-1">{dayOfWeekReport.bestDay}</div>
			</div>
			<div class="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
				<div class="text-xs text-red-400/70">วันที่แย่ที่สุด</div>
				<div class="text-2xl font-bold text-red-400 mt-1">{dayOfWeekReport.worstDay}</div>
			</div>
		</div>

		<!-- Bar chart -->
		{@const maxAbsDayPnl = sortedDays.reduce((max: number, d: DayOfWeekItem) => { const v = Math.abs(d.netPnl); return v > max ? v : max; }, 1)}
		<div class="space-y-2 mb-6">
			{#each dayOfWeekReport.days.sort((a: DayOfWeekItem, b: DayOfWeekItem) => a.dayIdx - b.dayIdx) as day}
				<div class="flex items-center gap-3">
					<div class="w-10 text-sm font-semibold text-gray-300 shrink-0">{day.day}</div>
					<div class="flex-1 flex items-center">
						{#if day.netPnl >= 0}
							<div class="h-6 rounded-r bg-green-500/40" style="width: {(day.netPnl / maxAbsDayPnl) * 100}%"></div>
						{:else}
							<div class="h-6 rounded-l bg-red-500/40 ml-auto" style="width: {(Math.abs(day.netPnl) / maxAbsDayPnl) * 100}%"></div>
						{/if}
					</div>
					<div class="w-24 text-right text-sm font-medium {day.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(day.netPnl)}
					</div>
				</div>
			{/each}
		</div>

		<!-- Sortable table -->
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-400 text-[11px] uppercase tracking-wider">
						{#each [
							{ key: 'dayIdx', label: 'วัน' },
							{ key: 'trades', label: 'เทรด' },
							{ key: 'winRate', label: 'อัตราชนะ' },
							{ key: 'profitFactor', label: 'PF' },
							{ key: 'netPnl', label: 'กำไรสุทธิ' },
							{ key: 'avgPnl', label: 'เฉลี่ย' },
							{ key: 'avgHoldMinutes', label: 'ถือเฉลี่ย' },
							{ key: 'bestTrade', label: 'ดีสุด' },
							{ key: 'worstTrade', label: 'แย่สุด' },
						] as col}
							<th class="{col.key === 'dayIdx' ? 'text-left' : 'text-right'} py-2.5 font-medium cursor-pointer hover:text-gray-300 select-none" onclick={() => toggleDaySort(col.key)}>
								{col.label}
								{#if daySort.key === col.key}
									<span class="ml-0.5">{daySort.asc ? '▲' : '▼'}</span>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sortedDays as day}
						<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
							<td class="py-2.5 font-medium text-white">{day.day}</td>
							<td class="py-2.5 text-right text-gray-300">{day.trades}</td>
							<td class="py-2.5 text-right {day.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{day.winRate.toFixed(0)}%</td>
							<td class="py-2.5 text-right {day.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{day.profitFactor === Infinity ? '∞' : formatNumber(day.profitFactor)}</td>
							<td class="py-2.5 text-right font-medium {day.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(day.netPnl)}</td>
							<td class="py-2.5 text-right {day.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(day.avgPnl)}</td>
							<td class="py-2.5 text-right text-gray-300">{formatHoldTime(day.avgHoldMinutes)}</td>
							<td class="py-2.5 text-right text-green-400">{formatCurrency(day.bestTrade)}</td>
							<td class="py-2.5 text-right text-red-400">{formatCurrency(day.worstTrade)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
