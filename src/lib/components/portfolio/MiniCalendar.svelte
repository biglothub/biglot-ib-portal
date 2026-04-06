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

	const weekRows = $derived.by(() => {
		const rows: typeof calendarDays[] = [];
		for (let i = 0; i < calendarDays.length; i += 7) {
			rows.push(calendarDays.slice(i, i + 7));
		}
		return rows;
	});

	const weekSummaries = $derived(weekRows.map((row, idx) => {
		const tradeDays = row.filter(d => d.day > 0 && d.trades != null && d.trades > 0);
		const profit = tradeDays.reduce((s, d) => s + (d.profit ?? 0), 0);
		return { label: `W${idx + 1}`, profit, days: tradeDays.length };
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

<div class="w-full select-none">
	<!-- Header -->
	<div class="flex items-center justify-between mb-2">
		<div class="flex items-center gap-0.5">
			<button onclick={prevMonth} aria-label="เดือนก่อนหน้า"
				class="p-1.5 rounded-md hover:bg-dark-hover text-gray-500 hover:text-white transition-colors">
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
				</svg>
			</button>
			<span class="text-sm font-bold text-white min-w-[88px] text-center tracking-tight">
				{monthNames[month - 1]} {year}
			</span>
			<button onclick={nextMonth} aria-label="เดือนถัดไป"
				class="p-1.5 rounded-md hover:bg-dark-hover text-gray-500 hover:text-white transition-colors">
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/>
				</svg>
			</button>
		</div>

		<div class="flex items-center gap-2">
			<!-- Monthly summary chips -->
			{#if monthSummary.tradingDays > 0}
				<div class="flex items-center gap-1.5">
					<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full
						{monthSummary.totalProfit >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}">
						{formatCurrency(monthSummary.totalProfit)}
					</span>
					<span class="text-[10px] text-gray-500">{monthSummary.tradingDays}d</span>
				</div>
			{/if}
			<button onclick={goToday}
				class="px-2 py-0.5 text-[10px] font-medium rounded-md border border-dark-border text-gray-500 hover:text-white hover:border-gray-500 transition-colors">
				วันนี้
			</button>
		</div>
	</div>

	<div class="flex gap-1.5">
		<!-- Calendar grid -->
		<div class="flex-1 min-w-0">
			<!-- Day headers -->
			<div class="grid grid-cols-7 text-center mb-1">
				{#each ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as d}
					<div class="py-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wide">{d}</div>
				{/each}
			</div>

			<!-- Calendar rows -->
			<div class="flex flex-col gap-0.5">
				{#each weekRows as row}
					<div class="grid grid-cols-7 gap-0.5">
						{#each row as day}
							{#if day.day === 0}
								<div class="min-h-[50px]"></div>
							{:else}
								{@const isToday = day.date === today}
								{@const hasData = day.trades != null && day.trades > 0}
								{@const isProfit = (day.profit ?? 0) >= 0}
								<button
									onclick={() => onDayClick?.(day.date)}
									disabled={!onDayClick || !hasData}
									title={hasData ? `${formatCurrency(day.profit ?? 0)} · ${day.trades} trades` : ''}
									class="w-full rounded-lg text-center min-h-[50px] flex flex-col items-center justify-start pt-1.5 pb-1 px-0.5 transition-all relative overflow-hidden
										{hasData
											? isProfit
												? 'bg-green-500/10 hover:bg-green-500/18'
												: 'bg-red-500/10 hover:bg-red-500/18'
											: 'hover:bg-white/[0.03]'}
										{isToday ? 'ring-1 ring-brand-primary/70' : ''}
										{onDayClick && hasData ? 'cursor-pointer' : 'cursor-default'}"
								>
									<!-- Date number -->
									<div class="text-[11px] font-bold leading-none
										{isToday
											? 'text-brand-primary'
											: hasData
												? isProfit ? 'text-green-400' : 'text-red-400'
												: 'text-gray-500'}">
										{day.day}
									</div>

									{#if hasData}
										<!-- P&L -->
										<div class="text-[8px] font-semibold leading-tight mt-1
											{isProfit ? 'text-green-300' : 'text-red-300'}">
											{formatCurrency(day.profit ?? 0)}
										</div>
										<!-- Trade count -->
										<div class="text-[7px] text-gray-600 mt-0.5 leading-none">
											{day.trades}t
										</div>
										<!-- Win rate bar -->
										{#if day.winRate != null}
											<div class="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
												<div
													class="h-full transition-all {day.winRate >= 50 ? 'bg-green-500/60' : 'bg-red-500/60'}"
													style="width: {Math.round(day.winRate)}%">
												</div>
											</div>
										{/if}
									{/if}

									<!-- Today dot (no data) -->
									{#if isToday && !hasData}
										<div class="w-1 h-1 rounded-full bg-brand-primary/60 mt-1"></div>
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
			<div class="hidden sm:flex flex-col gap-0.5 w-[58px] shrink-0 pt-[22px]">
				{#each weekSummaries as wk, i}
					{#if i < weekRows.length}
						{@const hasWeekData = wk.days > 0}
						{@const isWeekProfit = wk.profit >= 0}
						<div class="min-h-[50px] rounded-lg px-1.5 py-1 flex flex-col justify-center gap-0.5
							{hasWeekData
								? isWeekProfit
									? 'bg-green-500/8 border border-green-500/15'
									: 'bg-red-500/8 border border-red-500/15'
								: 'bg-dark-surface/50 border border-dark-border/50'}">
							<div class="text-[8px] font-semibold text-gray-500 uppercase tracking-wide">{wk.label}</div>
							{#if hasWeekData}
								<div class="text-[10px] font-bold leading-none
									{isWeekProfit ? 'text-green-400' : 'text-red-400'}">
									{formatCurrency(wk.profit)}
								</div>
								<div class="text-[8px] text-gray-600 leading-none">{wk.days}d</div>
							{:else}
								<div class="text-[9px] text-gray-700 leading-none">—</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
