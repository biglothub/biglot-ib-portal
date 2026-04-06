<script lang="ts">
	import { formatCurrency } from '$lib/utils';

	let {
		dailyHistory = [],
		checklistTotal = 5,
		checklistDone = 0,
		onChecklistClick
	}: {
		dailyHistory?: Array<{ date: string; profit: number; totalTrades: number }>;
		checklistTotal?: number;
		checklistDone?: number;
		onChecklistClick?: () => void;
	} = $props();

	const dayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

	const monthNames = [
		'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
		'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
	];

	type DayCell = { date: string; profit: number; trades: number; isToday: boolean } | null;

	let hoveredCell = $state<NonNullable<DayCell> | null>(null);

	const todayStr = $derived(new Date().toISOString().slice(0, 10));

	const grid = $derived.by(() => {
		const todayDate = new Date();
		todayDate.setHours(0, 0, 0, 0);

		const endDate = new Date(todayDate);
		endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // snap to Saturday of current week
		const startDate = new Date(endDate);
		startDate.setDate(startDate.getDate() - (14 * 7 - 1));

		const map = new Map(dailyHistory.map((d) => [d.date, d]));

		const columns: DayCell[][] = [];
		const monthLabels: string[] = [];

		let cur = new Date(startDate);
		let prevMonth = -1;

		for (let col = 0; col < 14; col++) {
			const colDays: DayCell[] = [];
			let colFirstMonth = -1;

			for (let row = 0; row < 7; row++) {
				const dateStr = cur.toISOString().slice(0, 10);
				const isFuture = cur > todayDate;

				if (colFirstMonth === -1 && !isFuture) {
					colFirstMonth = cur.getMonth();
				}

				if (isFuture) {
					colDays.push(null);
				} else {
					const d = map.get(dateStr);
					colDays.push({
						date: dateStr,
						profit: d?.profit ?? 0,
						trades: d?.totalTrades ?? 0,
						isToday: dateStr === todayStr
					});
				}

				cur.setDate(cur.getDate() + 1);
			}

			columns.push(colDays);

			if (colFirstMonth !== -1 && colFirstMonth !== prevMonth) {
				monthLabels.push(monthNames[colFirstMonth]);
				prevMonth = colFirstMonth;
			} else {
				monthLabels.push('');
			}
		}

		return { columns, monthLabels };
	});

	const maxProfit = $derived.by(() => {
		let max = 0;
		for (const d of dailyHistory) {
			if (d.profit > max) max = d.profit;
		}
		return max || 1;
	});

	function cellColor(cell: NonNullable<DayCell>): string {
		if (cell.trades === 0) return 'bg-gray-600/8 border border-gray-600/15';
		if (cell.profit < 0) return 'bg-red-500/40 border border-red-500/20';
		const ratio = cell.profit / maxProfit;
		if (ratio > 0.66) return 'bg-emerald-500/80 border border-emerald-500/30';
		if (ratio > 0.33) return 'bg-emerald-500/50 border border-emerald-500/20';
		return 'bg-emerald-500/25 border border-emerald-500/10';
	}

	function formatDateLabel(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
	}

	const checklistPct = $derived(
		checklistTotal > 0 ? (checklistDone / checklistTotal) * 100 : 0
	);

	const stats = $derived.by(() => {
		let tradingDays = 0;
		let profitDays = 0;
		for (const d of dailyHistory) {
			if (d.totalTrades > 0) {
				tradingDays++;
				if (d.profit > 0) profitDays++;
			}
		}
		return { tradingDays, profitDays };
	});
</script>

<div class="rounded-xl bg-dark-surface border border-dark-border p-5 h-full flex flex-col overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2.5">
			<div class="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
				<svg class="w-3.5 h-3.5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M7 16l4-4 4 4 5-5" />
				</svg>
			</div>
			<div>
				<h3 class="text-sm font-semibold text-white leading-tight">Progress Tracker</h3>
				<p class="text-[11px] text-gray-500 leading-tight mt-0.5">14 สัปดาห์ที่ผ่านมา</p>
			</div>
		</div>

		{#if stats.tradingDays > 0}
			<div class="flex items-center gap-3">
				<div class="text-right">
					<div class="text-[10px] text-gray-400 leading-tight">วันเทรด</div>
					<div class="text-xs font-semibold text-white leading-tight mt-0.5">{stats.tradingDays}</div>
				</div>
				<div class="w-px h-5 bg-dark-border"></div>
				<div class="text-right">
					<div class="text-[10px] text-gray-400 leading-tight">Win days</div>
					<div class="text-xs font-semibold text-emerald-400 leading-tight mt-0.5">{stats.profitDays}</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Heatmap -->
	<div class="flex gap-1 flex-1 overflow-x-auto">
		<!-- Day-of-week labels -->
		<div class="flex flex-col gap-[3px] mt-[18px]">
			{#each dayLabels as label, i}
				<div class="h-[14px] w-6 text-[10px] text-gray-500 leading-[14px] flex items-center justify-end pr-1">
					{i % 2 === 1 ? label : ''}
				</div>
			{/each}
		</div>

		<!-- Grid + month labels -->
		<div class="flex flex-col min-w-0 flex-1">
			<!-- Month labels row -->
			<div class="flex gap-[3px] h-[18px] mb-px">
				{#each grid.columns as _, ci}
					<div class="flex-1 text-[10px] text-gray-500 truncate leading-[18px]">
						{grid.monthLabels[ci]}
					</div>
				{/each}
			</div>

			<!-- Cell columns -->
			<div class="flex gap-[3px]">
				{#each grid.columns as col}
					<div class="flex flex-col gap-[3px] flex-1">
						{#each col as cell}
							{#if cell !== null}
								<div
									class="aspect-square rounded-[3px] {cellColor(cell)} transition-all duration-150
										{cell.isToday ? 'ring-1 ring-brand-primary/60 ring-offset-1 ring-offset-dark-surface' : ''}
										hover:scale-110 hover:z-10 hover:brightness-125 cursor-default"
									role="gridcell"
									tabindex="0"
									aria-label="{cell.date}: {cell.trades > 0 ? `${formatCurrency(cell.profit)} (${cell.trades} trades)` : 'ไม่มีเทรด'}"
									onmouseenter={() => hoveredCell = cell}
									onmouseleave={() => hoveredCell = null}
									onfocus={() => hoveredCell = cell}
									onblur={() => hoveredCell = null}
								></div>
							{:else}
								<div class="aspect-square"></div>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Hover info / Legend bar -->
	<div class="h-7 mt-3 flex items-center justify-between">
		{#if hoveredCell}
			<div class="flex items-center gap-2 text-xs">
				<span class="text-gray-400">{formatDateLabel(hoveredCell.date)}</span>
				{#if hoveredCell.trades > 0}
					<span class="w-px h-3 bg-dark-border"></span>
					<span class="{hoveredCell.profit >= 0 ? 'text-emerald-400' : 'text-red-400'} font-medium font-mono">
						{hoveredCell.profit >= 0 ? '+' : ''}{formatCurrency(hoveredCell.profit)}
					</span>
					<span class="text-gray-500">{hoveredCell.trades} trades</span>
				{:else}
					<span class="text-gray-500">ไม่มีเทรด</span>
				{/if}
			</div>
		{:else}
			<div class="flex items-center gap-1.5 text-[10px] text-gray-500">
				<span>ขาดทุน</span>
				<div class="w-[14px] h-[14px] rounded-[3px] bg-red-500/40 border border-red-500/20"></div>
				<div class="w-3 bg-dark-border h-px mx-0.5"></div>
				<div class="w-[14px] h-[14px] rounded-[3px] bg-gray-600/8 border border-gray-600/15"></div>
				<div class="w-[14px] h-[14px] rounded-[3px] bg-emerald-500/25 border border-emerald-500/10"></div>
				<div class="w-[14px] h-[14px] rounded-[3px] bg-emerald-500/50 border border-emerald-500/20"></div>
				<div class="w-[14px] h-[14px] rounded-[3px] bg-emerald-500/80 border border-emerald-500/30"></div>
				<span>กำไรมาก</span>
			</div>
		{/if}

		<div class="flex items-center gap-1.5 text-[10px] text-gray-500">
			<div class="w-[14px] h-[14px] rounded-[3px] bg-white/[0.03] ring-1 ring-brand-primary/60 ring-offset-1 ring-offset-dark-surface"></div>
			<span>วันนี้</span>
		</div>
	</div>

	<!-- Daily Checklist Section -->
	<div class="mt-3 pt-3 border-t border-dark-border">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3 flex-1 min-w-0">
				<div class="flex items-center gap-2 min-w-0">
					<svg class="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span class="text-xs text-gray-400">Daily Checklist</span>
				</div>
				<div class="flex items-center gap-2.5 flex-1 min-w-0">
					<span class="text-sm font-bold tabular-nums {checklistPct === 100 ? 'text-emerald-400' : 'text-white'}">{checklistDone}/{checklistTotal}</span>
					<div class="flex-1 max-w-[120px] h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
						<div
							class="h-full rounded-full transition-all duration-500 ease-out {checklistPct === 100 ? 'bg-emerald-500' : 'bg-brand-primary'}"
							style="width: {checklistPct}%"
						></div>
					</div>
				</div>
			</div>
			<button
				onclick={onChecklistClick}
				class="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-400
					border border-dark-border
					hover:text-white hover:border-gray-500 hover:bg-white/[0.03]
					active:scale-[0.97]
					transition-all duration-150"
			>
				เปิด Checklist
			</button>
		</div>
	</div>
</div>
