<script lang="ts">
	import { formatCurrency } from '$lib/utils';

	let { dailyHistory = [] }: {
		dailyHistory?: Array<{ date: string; profit: number; totalTrades: number }>;
	} = $props();

	let year = $state(new Date().getFullYear());
	let month = $state(new Date().getMonth() + 1);

	const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

	const calendarDays = $derived((() => {
		const firstDay = new Date(year, month - 1, 1).getDay();
		const daysInMonth = new Date(year, month, 0).getDate();
		const days: { day: number; date: string; profit?: number; trades?: number }[] = [];

		for (let i = 0; i < firstDay; i++) {
			days.push({ day: 0, date: '' });
		}

		const dailyMap = new Map((dailyHistory || []).map((item) => [item.date, item]));

		for (let day = 1; day <= daysInMonth; day++) {
			const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			const dayData = dailyMap.get(date);
			days.push({ day, date, profit: dayData?.profit, trades: dayData?.totalTrades });
		}
		return days;
	})());

	const monthSummary = $derived((() => {
		const prefix = `${year}-${String(month).padStart(2, '0')}`;
		const monthData = (dailyHistory || []).filter(d => d.date.startsWith(prefix));
		const totalProfit = monthData.reduce((sum, d) => sum + d.profit, 0);
		const totalTrades = monthData.reduce((sum, d) => sum + d.totalTrades, 0);
		const tradingDays = monthData.length;
		return { totalProfit, totalTrades, tradingDays };
	})());

	function prevMonth() {
		if (month === 1) { month = 12; year--; }
		else month--;
	}
	function nextMonth() {
		if (month === 12) { month = 1; year++; }
		else month++;
	}
</script>

<div>
	<!-- Month navigation -->
	<div class="flex items-center justify-between mb-3">
		<button onclick={prevMonth} aria-label="เดือนก่อนหน้า" class="p-1 rounded hover:bg-dark-hover text-gray-400 hover:text-white transition-colors">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
		</button>
		<span class="text-sm font-medium text-white">{monthNames[month - 1]} {year}</span>
		<button onclick={nextMonth} aria-label="เดือนถัดไป" class="p-1 rounded hover:bg-dark-hover text-gray-400 hover:text-white transition-colors">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
		</button>
	</div>

	<!-- Day headers -->
	<div class="grid grid-cols-7 text-center text-[10px] text-gray-500 mb-1">
		{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as d}
			<div class="py-0.5">{d}</div>
		{/each}
	</div>

	<!-- Calendar grid -->
	<div class="grid grid-cols-7 gap-0.5">
		{#each calendarDays as day}
			{#if day.day === 0}
				<div></div>
			{:else}
				<div class="rounded-md p-1 text-center min-h-[36px] flex flex-col items-center justify-center
					{day.profit != null
						? day.profit >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
						: ''}"
					title={day.profit != null ? `${formatCurrency(day.profit)} (${day.trades} trades)` : ''}
				>
					<div class="text-[11px] font-medium {day.profit != null ? day.profit >= 0 ? 'text-green-400' : 'text-red-400' : 'text-gray-600'}">
						{day.day}
					</div>
					{#if day.trades}
						<div class="text-[8px] {day.profit != null && day.profit >= 0 ? 'text-green-500/60' : 'text-red-500/60'}">
							{day.trades}t
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>

	<!-- Month summary -->
	{#if monthSummary.tradingDays > 0}
		<div class="mt-3 pt-2 border-t border-dark-border flex items-center justify-between text-[11px]">
			<span class="text-gray-500">{monthSummary.tradingDays} วัน / {monthSummary.totalTrades} trades</span>
			<span class="font-medium {monthSummary.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
				{formatCurrency(monthSummary.totalProfit)}
			</span>
		</div>
	{/if}
</div>
