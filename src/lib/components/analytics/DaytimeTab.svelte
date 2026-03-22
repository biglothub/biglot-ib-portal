<script lang="ts">
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency } from '$lib/utils';

	let { dayTimeHeatmap } = $props<{
		dayTimeHeatmap: Record<string, any> | null | undefined;
	}>();

	let heatmapMode = $state<'trades' | 'pnl' | 'winRate'>('pnl');
	const dayLabelsHeatmap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const hourLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

	function getHeatmapCell(day: number, hour: number) {
		return dayTimeHeatmap?.cells?.find((c: any) => c.day === day && c.hour === hour) || null;
	}

	function heatmapCellColor(cell: any): string {
		if (!cell || cell.trades === 0) return 'bg-dark-bg/20';
		if (heatmapMode === 'trades') {
			const max = dayTimeHeatmap?.maxTrades || 1;
			const intensity = Math.min(cell.trades / max, 1);
			if (intensity > 0.7) return 'bg-blue-500/70';
			if (intensity > 0.4) return 'bg-blue-500/40';
			return 'bg-blue-500/20';
		}
		if (heatmapMode === 'pnl') {
			const max = dayTimeHeatmap?.maxAbsPnl || 1;
			const intensity = Math.min(Math.abs(cell.pnl) / max, 1);
			if (cell.pnl > 0) {
				if (intensity > 0.6) return 'bg-green-500/60';
				if (intensity > 0.3) return 'bg-green-500/35';
				return 'bg-green-500/15';
			} else {
				if (intensity > 0.6) return 'bg-red-500/60';
				if (intensity > 0.3) return 'bg-red-500/35';
				return 'bg-red-500/15';
			}
		}
		// winRate
		if (cell.winRate >= 70) return 'bg-green-500/60';
		if (cell.winRate >= 50) return 'bg-green-500/30';
		if (cell.winRate >= 30) return 'bg-red-500/30';
		return 'bg-red-500/60';
	}
</script>

<!-- DAY & TIME HEATMAP -->
<div class="card">
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-lg font-semibold text-white">แผนที่ความร้อน วัน & เวลา</h2>
		<div class="flex gap-1 bg-dark-bg rounded-lg p-1">
			{#each [
				{ key: 'pnl', label: 'กำไร/ขาดทุน' },
				{ key: 'trades', label: 'เทรด' },
				{ key: 'winRate', label: 'อัตราชนะ' },
			] as mode}
				<button
					class="px-3 py-1.5 text-xs font-medium rounded-md transition-all {heatmapMode === mode.key ? 'bg-dark-surface text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
					onclick={() => heatmapMode = mode.key as any}
				>{mode.label}</button>
			{/each}
		</div>
	</div>

	<p class="text-xs text-gray-500 mb-4">เวลาแสดงเป็น UTC+7 (เวลาไทย)</p>

	{#if !dayTimeHeatmap || dayTimeHeatmap.cells.length === 0}
		<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับ heatmap" />
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full border-collapse">
				<thead>
					<tr>
						<th class="w-12"></th>
						{#each hourLabels as label, i}
							{#if i % 2 === 0}
								<th class="text-[9px] text-gray-500 font-normal px-0.5 pb-1" colspan="2">{label}</th>
							{/if}
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each dayLabelsHeatmap as dayName, dayIdx}
						<tr>
							<td class="text-xs text-gray-400 font-medium pr-2 py-0.5">{dayName}</td>
							{#each Array(24) as _, hour}
								{@const cell = getHeatmapCell(dayIdx, hour)}
								<td
									class="p-0.5"
									title={cell ? `${dayName} ${String(hour).padStart(2, '0')}:00 — ${cell.trades} เทรด, ${formatCurrency(cell.pnl)}, ชนะ ${cell.winRate.toFixed(0)}%` : `${dayName} ${String(hour).padStart(2, '0')}:00 — ไม่มีเทรด`}
								>
									<div class="w-full aspect-square rounded-sm min-w-[16px] {heatmapCellColor(cell)}"></div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Legend -->
		<div class="mt-4 flex items-center gap-4 text-xs text-gray-500">
			{#if heatmapMode === 'pnl'}
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/60"></div> กำไร</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/60"></div> ขาดทุน</div>
			{:else if heatmapMode === 'trades'}
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-blue-500/20"></div> น้อย</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-blue-500/40"></div> ปานกลาง</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-blue-500/70"></div> มาก</div>
			{:else}
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/60"></div> >70%</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/30"></div> 50-70%</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/30"></div> 30-50%</div>
				<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/60"></div> &lt;30%</div>
			{/if}
			<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-dark-bg/20"></div> ไม่มีเทรด</div>
		</div>
	{/if}
</div>
