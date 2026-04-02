<script lang="ts">
	import { formatCurrency } from '$lib/utils';

	let { dailyHistory = [], onDayClick, showWeekSummary = true }: {
		dailyHistory?: Array<{ date: string; profit: number; totalTrades: number; winRate?: number }>;
		onDayClick?: (date: string) => void;
		showWeekSummary?: boolean;
	} = $props();

	let year = $state(new Date().getFullYear());
	let month = $state(new Date().getMonth() + 1);

	const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

	const firstDay = $derived(new Date(year, month - 1, 1).getDay());
	const daysInMonth = $derived(new Date(year, month, 0).getDate());
	const today = new Date().toISOString().slice(0, 10);

	const dailyMap = $derived(new Map((dailyHistory || []).map(item => [item.date, item])));

	const calendarDays = $derived.by(() => {
		const days: { day: number; date: string; profit?: number; trades?: number; winRate?: number }[] = [];
		for (let i = 0; i < firstDay; i++) days.push({ day: 0, date: '' });
		for (let day = 1; day <= daysInMonth; day++) {
			const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			const d = dailyMap.get(date);
			days.push({ day, date, profit: d?.profit, trades: d?.totalTrades, winRate: d?.winRate });
		}
		return days;
	});

	// Group calendar rows into weeks (rows in the grid)
	const weekRows = $derived.by(() => {
		const rows: typeof calendarDays[] = [];
		for (let i = 0; i < calendarDays.length; i += 7) {
			rows.push(calendarDays.slice(i, i + 7));
		}
		return rows;
	});

	// Weekly summaries per row
	const weekSummaries = $derived(weekRows.map((row, idx) => {
		const tradeDays = row.filter(d => d.day > 0 && d.trades != null && d.trades > 0);
		const profit = tradeDays.reduce((s, d) => s + (d.profit ?? 0), 0);
		return { label: `Week ${idx + 1}`, profit, days: tradeDays.length };
	}));

	const monthSummary = $derived.by(() => {
		const prefix = `${year}-${String(month).padStart(2, '0')}`;
		const monthData = (dailyHistory || []).filter(d => d.date.startsWith(prefix));
		return {
			totalProfit: monthData.reduce((s, d) => s + d.profit, 0),
			totalTrades: monthData.reduce((s, d) => s + d.totalTrades, 0),
			tradingDays: monthData.length
		};
	});

	function prevMonth() { if (month === 1) { month = 12; year--; } else month--; }
	function nextMonth() { if (month === 12) { month = 1; year++; } else month++; }
	function goToday() { year = new Date().getFullYear(); month = new Date().getMonth() + 1; }
</script>

<div class="w-full">
	<!-- Header: navigation + monthly stats -->
	<div class="flex items-center justify-between mb-2">
		<div class="flex items-center gap-1">
			<button onclick={prevMonth} aria-label="เดือนก่อนหน้า"
				class="p-1.5 rounded hover:bg-dark-hover text-gray-400 hover:text-white transition-colors">
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
				</svg>
			</button>
			<span class="text-sm font-semibold text-white min-w-[80px] text-center">
				{monthNames[month - 1]} {year}
			</span>
			<button onclick={nextMonth} aria-label="เดือนถัดไป"
				class="p-1.5 rounded hover:bg-dark-hover text-gray-400 hover:text-white transition-colors">
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
				</svg>
			</button>
			<button onclick={goToday}
				class="ml-1 px-2 py-0.5 text-[10px] border border-dark-border rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
				เดือนนี้
			</button>
		</div>
		<!-- Monthly stats -->
		{#if monthSummary.tradingDays > 0}
			<div class="flex items-center gap-2 text-[11px]">
				<span class="text-gray-400">Monthly stats:</span>
				<span class="font-semibold {monthSummary.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
					{formatCurrency(monthSummary.totalProfit)}
				</span>
				<span class="text-gray-500">{monthSummary.tradingDays} วัน</span>
			</div>
		{/if}
	</div>

	<div class="flex gap-2">
		<!-- Calendar grid -->
		<div class="flex-1 min-w-0">
			<!-- Day headers -->
			<div class="grid grid-cols-7 text-center text-[10px] text-gray-500 mb-1">
				{#each ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as d}
					<div class="py-0.5">{d}</div>
				{/each}
			</div>

			<!-- Calendar rows -->
			<div class="flex flex-col gap-0.5">
				{#each weekRows as row}
					<div class="grid grid-cols-7 gap-0.5">
						{#each row as day}
							{#if day.day === 0}
								<div class="min-h-[44px]"></div>
							{:else}
								<button
									onclick={() => onDayClick?.(day.date)}
									disabled={!onDayClick}
									title={day.profit != null ? `${formatCurrency(day.profit)} (${day.trades} trades)` : ''}
									class="w-full rounded p-0.5 text-center min-h-[44px] flex flex-col items-center justify-center transition-colors relative
										{day.profit != null
											? day.profit >= 0 ? 'bg-green-500/10 hover:bg-green-500/20' : 'bg-red-500/10 hover:bg-red-500/20'
											: 'hover:bg-dark-hover'}
										{day.date === today ? 'ring-1 ring-brand-primary/60' : ''}
										{onDayClick && day.trades ? 'cursor-pointer' : 'cursor-default'}"
								>
									<!-- Date number -->
									<div class="text-[10px] font-semibold
										{day.date === today ? 'text-brand-primary' :
										day.profit != null ? (day.profit >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400'}">
										{day.day}
									</div>
									{#if day.trades}
										<!-- P&L -->
										<div class="text-[8px] font-medium leading-tight
											{day.profit != null && day.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
											{formatCurrency(day.profit ?? 0)}
										</div>
										<!-- Trades count -->
										<div class="text-[7px] text-gray-500 leading-tight">{day.trades}t</div>
									{/if}
								</button>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		</div>

		<!-- Weekly summary sidebar -->
		{#if showWeekSummary}
			<div class="hidden sm:flex flex-col gap-0.5 w-[68px] shrink-0 pt-5">
				{#each weekSummaries as wk, i}
					{#if i < weekRows.length}
						<div class="min-h-[44px] rounded p-1.5 bg-dark-surface border border-dark-border flex flex-col justify-center">
							<div class="text-[9px] text-gray-400 font-medium">{wk.label}</div>
							{#if wk.days > 0}
								<div class="text-[10px] font-semibold leading-tight
									{wk.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
									{formatCurrency(wk.profit)}
								</div>
								<div class="text-[8px] text-gray-400">{wk.days} วัน</div>
							{:else}
								<div class="text-[9px] text-gray-600">$0</div>
								<div class="text-[8px] text-gray-600">0 วัน</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
