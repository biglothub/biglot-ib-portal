<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import DayFeedCard from '$lib/components/portfolio/DayFeedCard.svelte';
	import MiniCalendar from '$lib/components/portfolio/MiniCalendar.svelte';
	import DayInsightsSection from '$lib/components/portfolio/DayInsightsSection.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';

	let { data } = $props();
	let { selectedDate, feed, calendarDays, weekData, selectedDayInsights } = $derived(data);

	let viewMode = $derived($page.url.searchParams.get('view') || 'day');
	let pendingView = $state<string | null>(null);
	let activeView = $derived(pendingView ?? viewMode);

	function switchView(mode: string) {
		pendingView = mode;
		const params = new URLSearchParams($page.url.searchParams);
		params.set('view', mode);
		if (selectedDate) params.set('date', selectedDate);
		goto(`/portfolio/day-view?${params.toString()}`, { keepFocus: true }).then(() => {
			pendingView = null;
		});
	}

	function handleCalendarClick(date: string) {
		const el = document.getElementById('day-' + date);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} else {
			// Date not in feed (no trades) — just navigate to that month
			const params = new URLSearchParams($page.url.searchParams);
			params.set('date', date);
			goto(`/portfolio/day-view?${params.toString()}`, { keepFocus: true });
		}
	}

	// Week view helpers
	function prevWeek() {
		if (!weekData) return;
		const d = new Date(weekData.weekStart + 'T00:00:00');
		d.setDate(d.getDate() - 7);
		const params = new URLSearchParams($page.url.searchParams);
		params.set('date', d.toISOString().split('T')[0]);
		params.set('view', 'week');
		goto(`/portfolio/day-view?${params.toString()}`, { keepFocus: true });
	}

	function nextWeek() {
		if (!weekData) return;
		const d = new Date(weekData.weekStart + 'T00:00:00');
		d.setDate(d.getDate() + 7);
		const params = new URLSearchParams($page.url.searchParams);
		params.set('date', d.toISOString().split('T')[0]);
		params.set('view', 'week');
		goto(`/portfolio/day-view?${params.toString()}`, { keepFocus: true });
	}

	function formatWeekRange(start: string, end: string) {
		const s = new Date(start + 'T00:00:00');
		const e = new Date(end + 'T00:00:00');
		return `${s.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	}

	// Scroll to selected date card on initial load
	onMount(() => {
		if (selectedDate && viewMode === 'day') {
			requestAnimationFrame(() => {
				document.getElementById('day-' + selectedDate)?.scrollIntoView({ block: 'start' });
			});
		}
	});
</script>

<div class="space-y-4">
	<!-- View toggle + Start my day -->
	<div class="flex items-center justify-between">
		<div class="flex gap-1 bg-dark-surface rounded-lg p-1">
			<button
				class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {activeView === 'day' ? 'bg-dark-bg text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
				onclick={() => switchView('day')}
			>รายวัน</button>
			<button
				class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {activeView === 'week' ? 'bg-dark-bg text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
				onclick={() => switchView('week')}
			>รายสัปดาห์</button>
		</div>
	</div>

	{#if viewMode === 'day'}
		<!-- DAY VIEW: feed + sticky calendar -->
		<div class="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-6">

			<!-- LEFT: Day feed -->
			<div class="space-y-3">
				<!-- Day insights for selected date -->
				{#if selectedDayInsights && selectedDayInsights.length > 0}
					<div class="card">
						<DayInsightsSection insights={selectedDayInsights} />
					</div>
				{/if}

				{#if feed.length === 0}
					<EmptyState message="ยังไม่มี trade ในช่วงเวลานี้" />
				{:else}
					{#each feed as entry (entry.date)}
						<DayFeedCard
							{entry}
							defaultExpanded={entry.date === selectedDate}
						/>
					{/each}
				{/if}
			</div>

			<!-- RIGHT: Sticky calendar -->
			<div class="xl:sticky xl:top-4 self-start">
				<div class="card">
					<MiniCalendar
						dailyHistory={calendarDays}
						onDayClick={handleCalendarClick}
					/>
				</div>
			</div>
		</div>

	{:else}
		<!-- WEEK VIEW -->
		{#if weekData}
			<div class="space-y-4">
				<!-- Week navigation -->
				<div class="card">
					<div class="flex items-center justify-between">
						<button onclick={prevWeek} aria-label="สัปดาห์ที่แล้ว" class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-bg/50">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
						</button>
						<div class="text-center">
							<h2 class="text-lg font-semibold text-white">{formatWeekRange(weekData.weekStart, weekData.weekEnd)}</h2>
							<p class="text-sm {weekData.stats.grossPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
								กำไรสุทธิ: {formatCurrency(weekData.stats.grossPnl)}
							</p>
						</div>
						<button onclick={nextWeek} aria-label="สัปดาห์ถัดไป" class="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-bg/50">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
						</button>
					</div>
				</div>

				<!-- Day cards -->
				<div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
					{#each weekData.dayCards as card}
						<button
							onclick={() => { const params = new URLSearchParams(); params.set('date', card.date); params.set('view', 'day'); goto(`/portfolio/day-view?${params.toString()}`); }}
							class="card text-center p-4 hover:border-brand-primary/40 transition-colors {card.date === selectedDate ? 'border-brand-primary' : ''}"
						>
							<div class="text-xs text-gray-400 font-medium">{card.day}</div>
							{#if card.hasData}
								<div class="mt-2 text-lg font-bold {card.pnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(card.pnl)}</div>
								<div class="mt-1 text-xs text-gray-400">{card.trades} รายการ</div>
							{:else}
								<div class="mt-2 text-sm text-gray-400">—</div>
								<div class="mt-1 text-xs text-gray-400">ไม่มี trade</div>
							{/if}
						</button>
					{/each}
				</div>

				<!-- Week stats -->
				{#if weekData.stats.totalTrades > 0}
					<div class="card">
						<h3 class="text-sm font-medium text-gray-400 mb-3">สรุปประจำสัปดาห์</h3>
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
							<div>
								<div class="text-xs text-gray-400">จำนวน Trade</div>
								<div class="text-xl font-bold text-white">{weekData.stats.totalTrades}</div>
							</div>
							<div>
								<div class="text-xs text-gray-400">อัตราชนะ</div>
								<div class="text-xl font-bold {weekData.stats.winRate >= 50 ? 'text-green-400' : 'text-amber-400'}">{weekData.stats.winRate.toFixed(0)}%</div>
							</div>
							<div>
								<div class="text-xs text-gray-400">Profit Factor</div>
								<div class="text-xl font-bold {weekData.stats.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{formatNumber(weekData.stats.profitFactor)}</div>
							</div>
							<div>
								<div class="text-xs text-gray-400">ชนะ / แพ้</div>
								<div class="text-xl font-bold text-white">
									<span class="text-green-400">{weekData.stats.winners}</span>
									<span class="text-gray-400 mx-1">/</span>
									<span class="text-red-400">{weekData.stats.losers}</span>
								</div>
							</div>
						</div>

						<!-- Daily P&L bars -->
						{#if weekData.dayCards.some((c: { hasData: boolean }) => c.hasData)}
							{@const maxPnl = weekData.dayCards.reduce((max: number, c: { pnl: number }) => Math.max(max, Math.abs(c.pnl)), 1)}
							<div class="mt-6">
								<div class="text-xs text-gray-400 mb-2">กำไร/ขาดทุนรายวัน</div>
								<div class="flex items-end gap-2 h-24">
									{#each weekData.dayCards as card}
										<div class="flex-1 flex flex-col items-center justify-end h-full">
											{#if card.hasData}
												<div
													class="w-full rounded-t {card.pnl >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'}"
													style="height: {Math.max((Math.abs(card.pnl) / maxPnl) * 80, 4)}%"
												></div>
											{:else}
												<div class="w-full h-[2px] bg-gray-700 rounded"></div>
											{/if}
											<div class="text-[10px] text-gray-400 mt-1">{card.day.slice(0, 2)}</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Week trade list -->
				<div class="card">
					<h3 class="text-sm font-medium text-gray-400 mb-3">รายการ Trade ประจำสัปดาห์</h3>
					{#if weekData.trades.length === 0}
						<EmptyState message="ไม่มี trade ในสัปดาห์นี้" />
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-gray-700/50 text-gray-400 text-xs">
										<th class="text-left py-2">วัน</th>
										<th class="text-left py-2">เวลา</th>
										<th class="text-left py-2">สัญลักษณ์</th>
										<th class="text-left py-2">ประเภท</th>
										<th class="text-right py-2">กำไร/ขาดทุน</th>
									</tr>
								</thead>
								<tbody>
									{#each weekData.trades as trade}
										<tr class="border-b border-gray-700/30 hover:bg-dark-bg/30">
											<td class="py-3 text-gray-400 text-xs">{new Date(trade.close_time).toLocaleDateString('th-TH', { month: '2-digit', day: '2-digit' })}</td>
											<td class="py-3 text-gray-400">{new Date(trade.close_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
											<td class="py-3">
												<a href="/portfolio/trades/{trade.id}" class="font-medium text-white hover:text-brand-primary">{trade.symbol}</a>
											</td>
											<td class="py-3">
												<span class="text-xs px-1.5 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
													{trade.type}
												</span>
											</td>
											<td class="py-3 text-right font-medium {Number(trade.profit) >= 0 ? 'text-green-400' : 'text-red-400'}">
												{formatCurrency(trade.profit)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<EmptyState message="ไม่มีข้อมูลสัปดาห์นี้" />
		{/if}
	{/if}
</div>
