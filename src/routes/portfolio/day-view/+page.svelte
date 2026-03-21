<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DayMiniPnlChart from '$lib/components/charts/DayMiniPnlChart.svelte';
	import DayInsightsSection from '$lib/components/portfolio/DayInsightsSection.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatDateTime, formatNumber, formatPercent } from '$lib/utils';

	let { data } = $props();
	let { selectedDate, viewMode, dayTrades, daySummary, weekData, calendarDays, intradayCumPnl, dayInsights } = $derived(data);

	// Calendar state
	let calendarDate = $derived(new Date((selectedDate || new Date().toISOString().split('T')[0]) + 'T00:00:00'));
	let calendarYear = $derived(calendarDate.getFullYear());
	let calendarMonth = $derived(calendarDate.getMonth());

	const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
		'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
	const dayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

	// Build calendar grid
	const calendarGrid = $derived.by(() => {
		const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
		const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
		const grid: Array<{ date: string; day: number; inMonth: boolean; pnl: number; trades: number } | null> = [];

		// Empty cells before first day
		for (let i = 0; i < firstDay; i++) grid.push(null);

		for (let d = 1; d <= daysInMonth; d++) {
			const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			const dayData = calendarDays?.find((cd: any) => cd.date === dateStr);
			grid.push({
				date: dateStr,
				day: d,
				inMonth: true,
				pnl: dayData?.pnl || 0,
				trades: dayData?.trades || 0
			});
		}
		return grid;
	});

	function navigateDate(date: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('date', date);
		goto(`/portfolio/day-view?${params.toString()}`, { keepFocus: true });
	}

	function switchView(mode: string) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('view', mode);
		if (selectedDate) params.set('date', selectedDate);
		goto(`/portfolio/day-view?${params.toString()}`, { keepFocus: true });
	}

	function prevMonth() {
		const d = new Date(calendarYear, calendarMonth - 1, 1);
		const dateStr = d.toISOString().split('T')[0];
		navigateDate(dateStr);
	}

	function nextMonth() {
		const d = new Date(calendarYear, calendarMonth + 1, 1);
		const dateStr = d.toISOString().split('T')[0];
		navigateDate(dateStr);
	}

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

	// Day cell color based on P&L
	function dayColor(pnl: number, trades: number) {
		if (trades === 0) return '';
		if (pnl > 0) return 'bg-green-500/20 text-green-400 font-semibold';
		if (pnl < 0) return 'bg-red-500/20 text-red-400 font-semibold';
		return 'bg-gray-500/10 text-gray-400';
	}

	function formatDateLabel(dateStr: string) {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
	}

	function formatWeekRange(start: string, end: string) {
		const s = new Date(start + 'T00:00:00');
		const e = new Date(end + 'T00:00:00');
		return `${s.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	}
</script>

<div class="space-y-6">
	<!-- View Toggle -->
	<div class="flex items-center justify-between">
		<div class="flex gap-1 bg-dark-surface rounded-lg p-1">
			<button
				class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {viewMode === 'day' ? 'bg-dark-bg text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
				onclick={() => switchView('day')}
			>รายวัน</button>
			<button
				class="px-4 py-1.5 text-sm font-medium rounded-md transition-all {viewMode === 'week' ? 'bg-dark-bg text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
				onclick={() => switchView('week')}
			>รายสัปดาห์</button>
		</div>
	</div>

	{#if viewMode === 'day'}
		<!-- DAY VIEW -->
		<div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
			<!-- Main content (3 cols) -->
			<div class="xl:col-span-3 space-y-4">
				<!-- Date header -->
				<div class="card">
					<h2 class="text-lg font-semibold text-white">{formatDateLabel(selectedDate || '')}</h2>

					{#if daySummary}
						<div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
							<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
								<div class="text-xs text-gray-500">กำไร/ขาดทุน</div>
								<div class="mt-1 text-xl font-bold {daySummary.pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
									{formatCurrency(daySummary.pnl)}
								</div>
							</div>
							<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
								<div class="text-xs text-gray-500">จำนวน Trade</div>
								<div class="mt-1 text-xl font-bold text-white">{daySummary.totalTrades}</div>
							</div>
							<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
								<div class="text-xs text-gray-500">อัตราชนะ</div>
								<div class="mt-1 text-xl font-bold {daySummary.winRate >= 50 ? 'text-green-400' : 'text-amber-400'}">
									{daySummary.winRate.toFixed(0)}%
								</div>
							</div>
							<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
								<div class="text-xs text-gray-500">ชนะ / แพ้</div>
								<div class="mt-1 text-xl font-bold text-white">
									<span class="text-green-400">{daySummary.wins}</span>
									<span class="text-gray-600 mx-1">/</span>
									<span class="text-red-400">{daySummary.losses}</span>
								</div>
							</div>
						</div>
					{/if}

					<!-- Day-level insights -->
					{#if dayInsights && dayInsights.length > 0}
						<div class="mt-4">
							<DayInsightsSection insights={dayInsights} />
						</div>
					{/if}
				</div>

				<!-- Mini P&L chart + เพิ่มบันทึก -->
				{#if intradayCumPnl && intradayCumPnl.length > 1}
					<div class="card">
						<div class="flex items-center justify-between mb-2">
							<h3 class="text-sm font-medium text-gray-400">กำไร/ขาดทุนระหว่างวัน</h3>
							<a
								href="/portfolio/notebook?linked_date={selectedDate}"
								class="flex items-center gap-1 rounded-lg border border-dark-border px-2.5 py-1.5 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
								เพิ่มบันทึก
							</a>
						</div>
						<DayMiniPnlChart data={intradayCumPnl} />
					</div>
				{:else if daySummary}
					<div class="flex justify-end">
						<a
							href="/portfolio/notebook?linked_date={selectedDate}"
							class="flex items-center gap-1 rounded-lg border border-dark-border px-2.5 py-1.5 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors"
						>
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
							เพิ่มบันทึก
						</a>
					</div>
				{/if}

				<!-- Trade list -->
				<div class="card">
					<h3 class="text-sm font-medium text-gray-400 mb-3">รายการ Trade</h3>
					{#if dayTrades.length === 0}
						<EmptyState message="ไม่มี trade ในวันนี้" />
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-dark-border text-gray-500 text-xs">
										<th class="text-left py-2">เวลา</th>
										<th class="text-left py-2">สัญลักษณ์</th>
										<th class="text-left py-2">ประเภท</th>
										<th class="text-right py-2">ล็อต</th>
										<th class="text-right py-2">ราคาเปิด</th>
										<th class="text-right py-2">ราคาปิด</th>
										<th class="text-right py-2">กำไร/ขาดทุน</th>
									</tr>
								</thead>
								<tbody>
									{#each dayTrades as trade}
										<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
											<td class="py-3 text-gray-400">{new Date(trade.close_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td>
											<td class="py-3">
												<a href="/portfolio/trades/{trade.id}" class="font-medium text-white hover:text-brand-primary">{trade.symbol}</a>
											</td>
											<td class="py-3">
												<span class="text-xs px-1.5 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
													{trade.type}
												</span>
											</td>
											<td class="py-3 text-right text-gray-400">{formatNumber(trade.lot_size, 2)}</td>
											<td class="py-3 text-right text-gray-400">{formatNumber(trade.open_price, 5)}</td>
											<td class="py-3 text-right text-gray-400">{formatNumber(trade.close_price, 5)}</td>
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

			<!-- Calendar sidebar (1 col) -->
			<div class="xl:col-span-1">
				<div class="card sticky top-4">
					<div class="flex items-center justify-between mb-3">
						<button onclick={prevMonth} aria-label="เดือนที่แล้ว" class="p-2 text-gray-400 hover:text-white">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
						</button>
						<span class="text-sm font-semibold text-white">{monthNames[calendarMonth]} {calendarYear}</span>
						<button onclick={nextMonth} aria-label="เดือนถัดไป" class="p-2 text-gray-400 hover:text-white">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
						</button>
					</div>

					<!-- Day labels -->
					<div class="grid grid-cols-7 gap-1 mb-1">
						{#each dayLabels as label}
							<div class="text-center text-[10px] text-gray-500 font-medium py-1">{label}</div>
						{/each}
					</div>

					<!-- Calendar grid -->
					<div class="grid grid-cols-7 gap-1">
						{#each calendarGrid as cell}
							{#if cell}
								<button
									onclick={() => navigateDate(cell.date)}
									class="aspect-square flex items-center justify-center text-xs rounded-lg transition-all
										{cell.date === selectedDate ? 'ring-2 ring-brand-primary' : ''}
										{dayColor(cell.pnl, cell.trades)}
										{cell.trades === 0 ? 'text-gray-600 hover:bg-dark-bg/50' : 'hover:ring-1 hover:ring-gray-500'}"
								>
									{cell.day}
								</button>
							{:else}
								<div></div>
							{/if}
						{/each}
					</div>
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
							<div class="text-xs text-gray-500 font-medium">{card.day}</div>
							{#if card.hasData}
								<div class="mt-2 text-lg font-bold {card.pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
									{formatCurrency(card.pnl)}
								</div>
								<div class="mt-1 text-xs text-gray-500">{card.trades} รายการ</div>
							{:else}
								<div class="mt-2 text-sm text-gray-600">—</div>
								<div class="mt-1 text-xs text-gray-600">ไม่มี trade</div>
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
								<div class="text-xs text-gray-500">จำนวน Trade</div>
								<div class="text-xl font-bold text-white">{weekData.stats.totalTrades}</div>
							</div>
							<div>
								<div class="text-xs text-gray-500">อัตราชนะ</div>
								<div class="text-xl font-bold {weekData.stats.winRate >= 50 ? 'text-green-400' : 'text-amber-400'}">
									{weekData.stats.winRate.toFixed(0)}%
								</div>
							</div>
							<div>
								<div class="text-xs text-gray-500">Profit Factor</div>
								<div class="text-xl font-bold {weekData.stats.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">
									{formatNumber(weekData.stats.profitFactor)}
								</div>
							</div>
							<div>
								<div class="text-xs text-gray-500">ชนะ / แพ้</div>
								<div class="text-xl font-bold text-white">
									<span class="text-green-400">{weekData.stats.winners}</span>
									<span class="text-gray-600 mx-1">/</span>
									<span class="text-red-400">{weekData.stats.losers}</span>
								</div>
							</div>
						</div>

						<!-- Daily P&L bar chart (simple CSS bars) -->
						{#if weekData.dayCards.some((c: any) => c.hasData)}
							{@const maxPnl = weekData.dayCards.reduce((max: number, c: any) => { const v = Math.abs(c.pnl); return v > max ? v : max; }, 1)}
							<div class="mt-6">
								<div class="text-xs text-gray-500 mb-2">กำไร/ขาดทุนรายวัน</div>
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
											<div class="text-[10px] text-gray-500 mt-1">{card.day.slice(0, 2)}</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Trade list -->
				<div class="card">
					<h3 class="text-sm font-medium text-gray-400 mb-3">รายการ Trade ประจำสัปดาห์</h3>
					{#if weekData.trades.length === 0}
						<EmptyState message="ไม่มี trade ในสัปดาห์นี้" />
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-dark-border text-gray-500 text-xs">
										<th class="text-left py-2">วัน</th>
										<th class="text-left py-2">เวลา</th>
										<th class="text-left py-2">สัญลักษณ์</th>
										<th class="text-left py-2">ประเภท</th>
										<th class="text-right py-2">กำไร/ขาดทุน</th>
									</tr>
								</thead>
								<tbody>
									{#each weekData.trades as trade}
										<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
											<td class="py-3 text-gray-400 text-xs">{new Date(trade.close_time).toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
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
		{/if}
	{/if}
</div>
