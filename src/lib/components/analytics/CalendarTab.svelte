<script lang="ts">
	import { formatCurrency } from '$lib/utils';

	let { calendarDays } = $props<{
		calendarDays: Array<{ date: string; pnl: number; trades: number }> | null | undefined;
	}>();

	let calendarYear = $state(new Date().getFullYear());
	const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	function getMonthGrid(year: number, month: number) {
		const firstDay = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const grid: Array<{ date: string; day: number; pnl: number; trades: number } | null> = [];
		for (let i = 0; i < firstDay; i++) grid.push(null);
		for (let d = 1; d <= daysInMonth; d++) {
			const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			const dayData = calendarDays?.find((cd: { date: string; pnl: number; trades: number }) => cd.date === dateStr);
			grid.push({ date: dateStr, day: d, pnl: dayData?.pnl || 0, trades: dayData?.trades || 0 });
		}
		return grid;
	}

	function calDayBg(pnl: number, trades: number) {
		if (trades === 0) return '';
		if (pnl > 0) return 'bg-green-500/30 text-green-300';
		if (pnl < 0) return 'bg-red-500/30 text-red-300';
		return 'bg-gray-500/20 text-gray-400';
	}
</script>

<!-- CALENDAR YEAR VIEW -->
<div class="card">
	<div class="flex items-center justify-between mb-6">
		<button onclick={() => calendarYear--} aria-label="ปีที่แล้ว" class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-bg/50">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
		</button>
		<h2 class="text-xl font-bold text-white">{calendarYear}</h2>
		<button onclick={() => calendarYear++} aria-label="ปีถัดไป" class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-bg/50">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
		</button>
	</div>

	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
		{#each Array(12) as _, monthIdx}
			{@const grid = getMonthGrid(calendarYear, monthIdx)}
			<div>
				<h3 class="text-sm font-semibold text-gray-300 mb-2">{monthNames[monthIdx]}</h3>
				<div class="grid grid-cols-7 gap-0.5">
					{#each dayLabels as label}
						<div class="text-center text-[9px] text-gray-400 py-0.5">{label}</div>
					{/each}
					{#each grid as cell}
						{#if cell}
							<div
								class="aspect-square flex items-center justify-center text-[10px] rounded {calDayBg(cell.pnl, cell.trades)}"
								title={cell.trades > 0 ? `${cell.date}: ${formatCurrency(cell.pnl)} (${cell.trades} เทรด)` : cell.date}
							>
								{cell.day}
							</div>
						{:else}
							<div></div>
						{/if}
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<!-- Legend -->
	<div class="mt-6 flex items-center gap-4 text-xs text-gray-400">
		<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-green-500/30"></div> กำไร</div>
		<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-red-500/30"></div> ขาดทุน</div>
		<div class="flex items-center gap-1.5"><div class="w-3 h-3 rounded bg-dark-bg"></div> ไม่มีเทรด</div>
	</div>
</div>
