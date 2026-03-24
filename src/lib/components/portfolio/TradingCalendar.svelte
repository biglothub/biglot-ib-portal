<script lang="ts">
	import { fade, scale } from 'svelte/transition';

	interface DayData {
		date: string;
		profit: number;
		totalTrades?: number;
		winRate?: number;
		bestTrade?: number;
		worstTrade?: number;
	}

	interface CalendarDay {
		date: Date;
		dayOfMonth: number;
		isCurrentMonth: boolean;
		isToday: boolean;
		data: DayData | null;
	}

	interface WeekSummary {
		weekNumber: number;
		totalPnL: number;
		tradingDays: number;
		totalTrades: number;
	}

	let { dailyData = [] }: { dailyData?: DayData[] } = $props();

	let currentDate = $state(new Date());
	let selectedDay = $state<CalendarDay | null>(null);
	let showDayModal = $state(false);
	let showStats = $state(false);
	let initialized = $state(false);

	const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	const dataMap = $derived(new Map((dailyData || []).map(d => [d.date, d])));
	const currentMonth = $derived(currentDate.getMonth());
	const currentYear = $derived(currentDate.getFullYear());
	const calendarDays = $derived(generateCalendarDays(currentYear, currentMonth, dataMap));
	const weeks = $derived(groupIntoWeeks(calendarDays));
	const weekSummaries = $derived(calculateWeekSummaries(weeks));
	const monthStats = $derived(calculateMonthStats(calendarDays));

	// Initialize to latest data date
	$effect(() => {
		if (dailyData && dailyData.length > 0 && !initialized) {
			const latestDate = dailyData[dailyData.length - 1]?.date;
			if (latestDate) {
				currentDate = new Date(latestDate);
				initialized = true;
			}
		}
	});

	function generateCalendarDays(year: number, month: number, dataMap: Map<string, DayData>): CalendarDay[] {
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const days: CalendarDay[] = [];

		const firstDayOfWeek = firstDay.getDay();
		for (let i = firstDayOfWeek - 1; i >= 0; i--) {
			const date = new Date(year, month, -i);
			days.push({ date, dayOfMonth: date.getDate(), isCurrentMonth: false, isToday: date.getTime() === today.getTime(), data: dataMap.get(formatDateKey(date)) || null });
		}

		for (let day = 1; day <= lastDay.getDate(); day++) {
			const date = new Date(year, month, day);
			days.push({ date, dayOfMonth: day, isCurrentMonth: true, isToday: date.getTime() === today.getTime(), data: dataMap.get(formatDateKey(date)) || null });
		}

		const remainingDays = 7 - (days.length % 7);
		if (remainingDays < 7) {
			for (let i = 1; i <= remainingDays; i++) {
				const date = new Date(year, month + 1, i);
				days.push({ date, dayOfMonth: i, isCurrentMonth: false, isToday: date.getTime() === today.getTime(), data: dataMap.get(formatDateKey(date)) || null });
			}
		}

		return days;
	}

	function formatDateKey(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function groupIntoWeeks(days: CalendarDay[]): CalendarDay[][] {
		const w: CalendarDay[][] = [];
		for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7));
		return w;
	}

	function calculateWeekSummaries(weeks: CalendarDay[][]): WeekSummary[] {
		return weeks.map((week, index) => {
			const dwd = week.filter(d => d.isCurrentMonth && d.data);
			return {
				weekNumber: index + 1,
				totalPnL: dwd.reduce((sum, d) => sum + (d.data?.profit || 0), 0),
				tradingDays: dwd.length,
				totalTrades: dwd.reduce((sum, d) => sum + (d.data?.totalTrades || 0), 0)
			};
		});
	}

	function calculateMonthStats(days: CalendarDay[]) {
		const md = days.filter(d => d.isCurrentMonth && d.data);
		if (md.length === 0) return { totalPnL: 0, bestDay: null as CalendarDay | null, worstDay: null as CalendarDay | null, avgDaily: 0, totalTrades: 0, tradingDays: 0, profitableDays: 0, lossDays: 0 };

		const profits = md.map(d => d.data!.profit);
		return {
			totalPnL: profits.reduce((a, b) => a + b, 0),
			bestDay: md.reduce((best, d) => d.data!.profit > (best.data?.profit || -Infinity) ? d : best, md[0]),
			worstDay: md.reduce((worst, d) => d.data!.profit < (worst.data?.profit || Infinity) ? d : worst, md[0]),
			avgDaily: profits.reduce((a, b) => a + b, 0) / md.length,
			totalTrades: md.reduce((sum, d) => sum + (d.data?.totalTrades || 0), 0),
			tradingDays: md.length,
			profitableDays: md.filter(d => d.data!.profit > 0).length,
			lossDays: md.filter(d => d.data!.profit < 0).length
		};
	}

	function previousMonth() { currentDate = new Date(currentYear, currentMonth - 1, 1); }
	function nextMonth() { currentDate = new Date(currentYear, currentMonth + 1, 1); }
	function goToToday() { currentDate = new Date(); }

	function handleDayClick(day: CalendarDay) {
		if (day.data) { selectedDay = day; showDayModal = true; }
	}
	function closeDayModal() { showDayModal = false; selectedDay = null; }

	function getProfitColor(profit: number): string {
		if (profit === 0 || profit === undefined) return 'bg-dark-border/50';
		if (profit > 500) return 'bg-emerald-500';
		if (profit > 100) return 'bg-emerald-400';
		if (profit > 0) return 'bg-emerald-300/80';
		if (profit > -100) return 'bg-red-300/80';
		if (profit > -500) return 'bg-red-400';
		return 'bg-red-500';
	}

	function getProfitTextColor(profit: number): string {
		if (profit > 0) return 'text-emerald-400';
		if (profit < 0) return 'text-red-400';
		return 'text-gray-400';
	}

	function formatMoney(amount: number): string {
		const sign = amount >= 0 ? '+' : '-';
		return sign + '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
	}

	function formatMoneyFull(amount: number): string {
		const sign = amount >= 0 ? '+' : '';
		return sign + '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
</script>

<div class="card overflow-hidden p-0">
	<!-- Header -->
	<div class="p-3 border-b border-dark-border">
		<div class="flex items-center justify-between gap-2 flex-wrap">
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4 text-brand-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<div class="flex items-center gap-1">
					<button onclick={previousMonth} class="p-2 rounded hover:bg-dark-border transition-colors" aria-label="Previous month">
						<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
					</button>
					<span class="text-sm font-semibold text-gray-200 min-w-[100px] text-center">
						{monthNames[currentMonth].slice(0, 3)} {currentYear}
					</span>
					<button onclick={nextMonth} class="p-2 rounded hover:bg-dark-border transition-colors" aria-label="Next month">
						<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
					</button>
					<button onclick={goToToday} aria-label="ไปวันนี้" class="ml-1 px-2 py-0.5 text-xs font-medium text-brand-primary bg-brand-primary/10 rounded hover:bg-brand-primary/20 transition-colors">
						วันนี้
					</button>
				</div>
			</div>

			<div class="flex items-center gap-3 text-xs">
				<div class="flex items-center gap-1">
					<span class="text-gray-400">เดือนนี้:</span>
					<span class="font-bold {getProfitTextColor(monthStats.totalPnL)}">{formatMoney(monthStats.totalPnL)}</span>
				</div>
				<div class="hidden sm:flex items-center gap-1">
					<span class="text-gray-400">วัน:</span>
					<span class="font-medium text-gray-300">{monthStats.profitableDays}W/{monthStats.lossDays}L</span>
				</div>
				<div class="hidden md:flex items-center gap-1">
					<span class="text-gray-400">เทรด:</span>
					<span class="font-medium text-gray-300">{monthStats.totalTrades}</span>
				</div>
				<button onclick={() => showStats = !showStats} class="p-2 rounded hover:bg-dark-border transition-colors" aria-label="Toggle stats">
					<svg class="w-4 h-4 text-gray-400 transition-transform {showStats ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			</div>
		</div>

		{#if showStats}
			<div class="mt-3 pt-3 border-t border-dark-border">
				<div class="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
					<div class="p-2 bg-dark-bg/50 rounded text-center">
						<div class="text-gray-400 mb-0.5">รวม</div>
						<div class="font-bold {getProfitTextColor(monthStats.totalPnL)}">{formatMoney(monthStats.totalPnL)}</div>
					</div>
					<div class="p-2 bg-dark-bg/50 rounded text-center">
						<div class="text-gray-400 mb-0.5">ดีที่สุด</div>
						<div class="font-bold {monthStats.bestDay ? getProfitTextColor(monthStats.bestDay.data?.profit || 0) : 'text-gray-400'}">
							{monthStats.bestDay ? formatMoney(monthStats.bestDay.data?.profit || 0) : '-'}
						</div>
					</div>
					<div class="p-2 bg-dark-bg/50 rounded text-center">
						<div class="text-gray-400 mb-0.5">แย่ที่สุด</div>
						<div class="font-bold {monthStats.worstDay ? getProfitTextColor(monthStats.worstDay.data?.profit || 0) : 'text-gray-400'}">
							{monthStats.worstDay ? formatMoney(monthStats.worstDay.data?.profit || 0) : '-'}
						</div>
					</div>
					<div class="p-2 bg-dark-bg/50 rounded text-center">
						<div class="text-gray-400 mb-0.5">เฉลี่ย/วัน</div>
						<div class="font-bold {getProfitTextColor(monthStats.avgDaily)}">{formatMoney(monthStats.avgDaily)}</div>
					</div>
					<div class="p-2 bg-dark-bg/50 rounded text-center">
						<div class="text-gray-400 mb-0.5">วันเทรด</div>
						<div class="font-bold text-gray-300">{monthStats.tradingDays}</div>
					</div>
					<div class="p-2 bg-dark-bg/50 rounded text-center">
						<div class="text-gray-400 mb-0.5">เทรด</div>
						<div class="font-bold text-gray-300">{monthStats.totalTrades}</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Calendar Grid -->
	<div class="p-2">
		<div class="grid grid-cols-7 gap-0.5 mb-1">
			{#each daysOfWeek as day, i}
				<div class="text-center text-[10px] font-semibold py-1 {i === 0 ? 'text-red-400' : i === 6 ? 'text-brand-primary' : 'text-gray-400'}">
					{day}
				</div>
			{/each}
		</div>

		<div class="grid grid-cols-7 gap-0.5">
			{#each calendarDays as day}
				<button
					class="relative aspect-square flex flex-col items-center justify-center rounded transition-all duration-200 group
						{day.isCurrentMonth ? '' : 'opacity-30'}
						{day.isToday ? 'ring-2 ring-brand-primary ring-offset-1 ring-offset-dark-surface' : ''}
						{day.data ? 'cursor-pointer hover:ring-2 hover:ring-brand-primary hover:scale-105 active:scale-95' : 'cursor-default'}
						{getProfitColor(day.data?.profit || 0)}"
					onclick={() => handleDayClick(day)}
					disabled={!day.data}
					aria-label="{day.date.toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' })}{day.data ? ` — ${formatMoneyFull(day.data.profit)}` : ''}"
				>
					<span class="text-[10px] sm:text-xs font-medium {day.isToday ? 'text-brand-primary' : 'text-gray-300'}">
						{day.dayOfMonth}
					</span>
					{#if day.data && day.isCurrentMonth}
						<span class="text-[8px] sm:text-[10px] font-bold {getProfitTextColor(day.data.profit)} truncate max-w-full px-0.5">
							{formatMoney(day.data.profit)}
						</span>
					{/if}

					{#if day.data}
						<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1.5 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-lg">
							<div class="font-semibold">{day.date.toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
							<div class={getProfitTextColor(day.data.profit)}>{formatMoneyFull(day.data.profit)}</div>
							<div class="text-gray-300">{day.data.totalTrades || 0} trades &bull; {(day.data.winRate || 0).toFixed(0)}%</div>
						</div>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Legend -->
		<div class="flex items-center justify-center gap-1 mt-2 text-[9px] text-gray-400" aria-label="สัญลักษณ์สี">
			<span>ขาดทุน</span>
			<div class="w-2.5 h-2.5 rounded-sm bg-red-500" aria-hidden="true"></div>
			<div class="w-2.5 h-2.5 rounded-sm bg-red-300/80" aria-hidden="true"></div>
			<div class="w-2.5 h-2.5 rounded-sm bg-dark-border/50" aria-hidden="true"></div>
			<div class="w-2.5 h-2.5 rounded-sm bg-emerald-300/80" aria-hidden="true"></div>
			<div class="w-2.5 h-2.5 rounded-sm bg-emerald-500" aria-hidden="true"></div>
			<span>กำไร</span>
		</div>
	</div>

	<!-- Weekly Summary -->
	<div class="px-2 pb-2">
		<div class="flex gap-1 overflow-x-auto pb-1">
			{#each weekSummaries as week}
				{#if week.tradingDays > 0}
					<div class="flex-shrink-0 px-2 py-1.5 bg-dark-bg/50 rounded text-center min-w-[60px]">
						<div class="text-[9px] text-gray-400">W{week.weekNumber}</div>
						<div class="text-xs font-bold {getProfitTextColor(week.totalPnL)}">{formatMoney(week.totalPnL)}</div>
						<div class="text-[8px] text-gray-400">{week.totalTrades}t</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
</div>

<!-- Day Detail Modal -->
{#if showDayModal && selectedDay?.data}
	<div
		transition:fade={{ duration: 200 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
		onclick={closeDayModal}
		onkeydown={(e) => e.key === 'Escape' && closeDayModal()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			transition:scale={{ start: 0.95, duration: 200 }}
			class="bg-dark-surface rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-dark-border"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="p-3 border-b border-dark-border flex items-center justify-between">
				<h3 class="text-sm font-bold text-white">
					{selectedDay.date.toLocaleDateString('th-TH', { weekday: 'long', month: 'short', day: 'numeric' })}
				</h3>
				<button onclick={closeDayModal} class="p-2 hover:bg-dark-border rounded transition-colors" aria-label="ปิด">
					<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="p-4">
				<div class="text-center mb-4">
					<div class="text-2xl font-bold {getProfitTextColor(selectedDay.data.profit)}">{formatMoneyFull(selectedDay.data.profit)}</div>
					<div class="text-xs text-gray-400">P&L รายวัน</div>
				</div>
				<div class="grid grid-cols-2 gap-2 text-center">
					<div class="p-2 bg-dark-bg/50 rounded">
						<div class="text-lg font-bold text-gray-200">{selectedDay.data.totalTrades || 0}</div>
						<div class="text-[10px] text-gray-400">เทรด</div>
					</div>
					<div class="p-2 bg-dark-bg/50 rounded">
						<div class="text-lg font-bold text-brand-primary">{(selectedDay.data.winRate || 0).toFixed(0)}%</div>
						<div class="text-[10px] text-gray-400">อัตราชนะ</div>
					</div>
					{#if selectedDay.data.bestTrade}
						<div class="p-2 bg-dark-bg/50 rounded">
							<div class="text-sm font-bold text-emerald-400">{formatMoney(selectedDay.data.bestTrade)}</div>
							<div class="text-[10px] text-gray-400">ดีที่สุด</div>
						</div>
					{/if}
					{#if selectedDay.data.worstTrade}
						<div class="p-2 bg-dark-bg/50 rounded">
							<div class="text-sm font-bold text-red-400">{formatMoney(selectedDay.data.worstTrade)}</div>
							<div class="text-[10px] text-gray-400">แย่ที่สุด</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
