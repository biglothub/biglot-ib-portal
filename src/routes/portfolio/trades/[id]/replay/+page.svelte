<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { formatCurrency, formatNumber, formatDateTime } from '$lib/utils';
	import type { IChartApi, ISeriesApi, SeriesMarker, Time } from 'lightweight-charts';
	import type { TradeChartContext, TradeChartBar } from '$lib/types';

	const BASE_INTERVAL_MS = 400;
	const SPEEDS = [1, 2, 5, 10] as const;

	let { data } = $props();
	let trade = $derived(data.trade);
	let chartContexts = $derived(data.chartContexts || []);

	// Chart refs
	let mainContainer = $state<HTMLDivElement>(undefined!);
	let pnlContainer = $state<HTMLDivElement>(undefined!);
	let mainChart: IChartApi | null;
	let mainSeries: ISeriesApi<'Candlestick'> | null;
	let pnlChart: IChartApi | null;
	let pnlSeries: ISeriesApi<'Line'> | null;
	let slLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null = null;
	let tpLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null = null;
	let entryLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null = null;
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// State
	let isPlaying = $state(false);
	let speed = $state(1);
	let currentIndex = $state(0);
	let selectedTimeframe = $state('');
	let loading = $state(true);
	let showMobileInfo = $state(false);

	let availableTimeframes = $derived(
		(chartContexts || []).map((c: TradeChartContext) => c.timeframe)
	);
	let currentContext = $derived(
		(chartContexts || []).find((c: TradeChartContext) => c.timeframe === selectedTimeframe) || chartContexts?.[0] || null
	);
	let allBars = $derived(
		(currentContext?.bars || []).map((bar: TradeChartBar) => ({
			time: bar.time,
			open: bar.open,
			high: bar.high,
			low: bar.low,
			close: bar.close
		}))
	);
	let totalBars = $derived(allBars.length);
	let currentBar = $derived(allBars[currentIndex] || null);
	let entryTimestamp = $derived(
		trade ? Math.floor(new Date(trade.open_time).getTime() / 1000) : 0
	);
	let exitTimestamp = $derived(
		trade ? Math.floor(new Date(trade.close_time).getTime() / 1000) : 0
	);
	let hasReachedEntry = $derived(currentBar != null && currentBar.time >= entryTimestamp);
	let hasReachedExit = $derived(currentBar != null && currentBar.time >= exitTimestamp);
	let progressPercent = $derived(totalBars > 1 ? (currentIndex / (totalBars - 1)) * 100 : 0);

	// P&L calculation: unrealized P&L from entry to current bar
	let pnlData = $derived(computePnlData());

	function computePnlData() {
		if (!trade || !allBars.length) return [];
		const entryPrice = Number(trade.open_price);
		const isBuy = trade.type === 'BUY';
		const lotSize = Number(trade.lot_size);
		const points: { time: number; value: number }[] = [];

		for (let i = 0; i <= currentIndex; i++) {
			const bar = allBars[i];
			if (bar.time < entryTimestamp) continue;

			let unrealizedPnl: number;
			if (bar.time >= exitTimestamp) {
				// After exit, show final P&L
				unrealizedPnl = Number(trade.profit);
			} else {
				// During trade: approximate P&L from price difference
				const priceDiff = isBuy ? (bar.close - entryPrice) : (entryPrice - bar.close);
				// Use pip-based calculation for forex (rough approximation)
				// profit ≈ (priceDiff / point_value) * lot_size * tick_value
				// We scale relative to actual trade profit for accuracy
				const totalPriceDiff = isBuy
					? (Number(trade.close_price) - entryPrice)
					: (entryPrice - Number(trade.close_price));
				if (Math.abs(totalPriceDiff) > 0) {
					unrealizedPnl = (priceDiff / totalPriceDiff) * Number(trade.profit);
				} else {
					unrealizedPnl = 0;
				}
			}
			points.push({ time: bar.time, value: Math.round(unrealizedPnl * 100) / 100 });
		}
		return points;
	}

	let currentPnl = $derived(pnlData.length > 0 ? pnlData[pnlData.length - 1]?.value ?? 0 : 0);
	let maxPnl = $derived(pnlData.length > 0 ? pnlData.reduce((max, p) => p.value > max ? p.value : max, -Infinity) : 0);
	let minPnl = $derived(pnlData.length > 0 ? pnlData.reduce((min, p) => p.value < min ? p.value : min, Infinity) : 0);

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		switch (e.key) {
			case ' ':
				e.preventDefault();
				isPlaying ? pause() : play();
				break;
			case 'ArrowRight':
				e.preventDefault();
				stepForward();
				break;
			case 'ArrowLeft':
				e.preventDefault();
				stepBackward();
				break;
			case 'r':
			case 'R':
				e.preventDefault();
				reset();
				break;
		}
	}

	function renderFrame() {
		if (!mainChart || !mainSeries || !allBars.length || !trade) return;

		const visibleBars = allBars.slice(0, currentIndex + 1);
		mainSeries.setData(visibleBars);

		// Entry/exit markers
		const markers: SeriesMarker<Time>[] = [];
		if (hasReachedEntry) {
			markers.push({
				time: entryTimestamp,
				position: trade.type === 'BUY' ? 'belowBar' : 'aboveBar',
				color: '#22c55e',
				shape: trade.type === 'BUY' ? 'arrowUp' : 'arrowDown',
				text: `Entry ${formatNumber(trade.open_price, 5)}`
			});
		}
		if (hasReachedExit) {
			markers.push({
				time: exitTimestamp,
				position: trade.type === 'BUY' ? 'aboveBar' : 'belowBar',
				color: '#f97316',
				shape: trade.type === 'BUY' ? 'arrowDown' : 'arrowUp',
				text: `Exit ${formatNumber(trade.close_price, 5)}`
			});
		}
		mainSeries.setMarkers(markers);

		// SL/TP price lines
		if (hasReachedEntry) {
			if (!slLine && trade.sl) {
				slLine = mainSeries.createPriceLine({
					price: Number(trade.sl), color: '#ef4444', lineWidth: 1, lineStyle: 2,
					axisLabelVisible: true, title: 'SL'
				});
			}
			if (!tpLine && trade.tp) {
				tpLine = mainSeries.createPriceLine({
					price: Number(trade.tp), color: '#22c55e', lineWidth: 1, lineStyle: 2,
					axisLabelVisible: true, title: 'TP'
				});
			}
			if (!entryLine) {
				entryLine = mainSeries.createPriceLine({
					price: Number(trade.open_price), color: '#C9A84C', lineWidth: 1, lineStyle: 1,
					axisLabelVisible: true, title: 'Entry'
				});
			}
		} else {
			if (slLine) { mainSeries.removePriceLine(slLine); slLine = null; }
			if (tpLine) { mainSeries.removePriceLine(tpLine); tpLine = null; }
			if (entryLine) { mainSeries.removePriceLine(entryLine); entryLine = null; }
		}

		mainChart.timeScale().fitContent();

		// P&L chart
		if (pnlChart && pnlSeries && pnlData.length > 0) {
			pnlSeries.setData(pnlData);
			pnlChart.timeScale().fitContent();
		} else if (pnlChart && pnlSeries) {
			pnlSeries.setData([]);
		}
	}

	function play() {
		if (totalBars <= 1) return;
		if (currentIndex >= totalBars - 1) currentIndex = 0;
		isPlaying = true;
		clearTimer();
		intervalId = setInterval(() => {
			if (currentIndex >= totalBars - 1) { pause(); return; }
			currentIndex++;
		}, BASE_INTERVAL_MS / speed);
	}

	function pause() {
		isPlaying = false;
		clearTimer();
	}

	function reset() {
		pause();
		currentIndex = 0;
		// Remove price lines on reset
		if (slLine) { mainSeries?.removePriceLine(slLine); slLine = null; }
		if (tpLine) { mainSeries?.removePriceLine(tpLine); tpLine = null; }
		if (entryLine) { mainSeries?.removePriceLine(entryLine); entryLine = null; }
	}

	function stepForward() {
		pause();
		if (currentIndex < totalBars - 1) currentIndex++;
	}

	function stepBackward() {
		pause();
		if (currentIndex > 0) {
			currentIndex--;
			// Remove price lines if before entry
			if (!hasReachedEntry) {
				if (slLine) { mainSeries?.removePriceLine(slLine); slLine = null; }
				if (tpLine) { mainSeries?.removePriceLine(tpLine); tpLine = null; }
				if (entryLine) { mainSeries?.removePriceLine(entryLine); entryLine = null; }
			}
		}
	}

	function onScrub(e: Event) {
		pause();
		const newIndex = parseInt((e.target as HTMLInputElement).value);
		// Reset price lines if scrubbing backward past entry
		if (newIndex < currentIndex) {
			if (slLine) { mainSeries?.removePriceLine(slLine); slLine = null; }
			if (tpLine) { mainSeries?.removePriceLine(tpLine); tpLine = null; }
			if (entryLine) { mainSeries?.removePriceLine(entryLine); entryLine = null; }
		}
		currentIndex = newIndex;
	}

	function setSpeed(s: number) {
		speed = s;
		if (isPlaying) {
			clearTimer();
			intervalId = setInterval(() => {
				if (currentIndex >= totalBars - 1) { pause(); return; }
				currentIndex++;
			}, BASE_INTERVAL_MS / speed);
		}
	}

	function clearTimer() {
		if (intervalId != null) { clearInterval(intervalId); intervalId = null; }
	}

	function formatBarTime(unixSeconds: number): string {
		return new Date(unixSeconds * 1000).toLocaleString('th-TH', {
			day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
		});
	}

	function getDuration(openTime: string, closeTime: string): string {
		const ms = new Date(closeTime).getTime() - new Date(openTime).getTime();
		const mins = Math.floor(ms / 60000);
		if (mins < 60) return `${mins} นาที`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours} ชม. ${mins % 60} นาที`;
		const days = Math.floor(hours / 24);
		return `${days} วัน ${hours % 24} ชม.`;
	}

	// Jump to entry
	function jumpToEntry() {
		pause();
		const idx = allBars.findIndex((b: { time: number }) => b.time >= entryTimestamp);
		if (idx >= 0) currentIndex = idx;
	}

	// Jump to exit
	function jumpToExit() {
		pause();
		const idx = allBars.findIndex((b: { time: number }) => b.time >= exitTimestamp);
		if (idx >= 0) currentIndex = idx;
	}

	onMount(() => {
		let observer1: ResizeObserver | undefined;
		let observer2: ResizeObserver | undefined;
		let destroyed = false;

		import('lightweight-charts').then(({ createChart, ColorType }) => {
			if (destroyed) return;

			const chartOptions = {
				layout: {
					background: { type: ColorType.Solid, color: 'transparent' },
					textColor: '#9ca3af',
					fontFamily: "'Inter', sans-serif"
				},
				grid: {
					vertLines: { color: 'rgba(55,65,81,0.25)' },
					horzLines: { color: 'rgba(55,65,81,0.25)' }
				},
				timeScale: {
					timeVisible: true,
					secondsVisible: false,
					borderColor: 'rgba(55,65,81,0.35)'
				},
				rightPriceScale: {
					borderColor: 'rgba(55,65,81,0.35)'
				},
				crosshair: {
					horzLine: { color: 'rgba(201,168,76,0.3)' },
					vertLine: { color: 'rgba(201,168,76,0.3)' }
				}
			};

			// Main candlestick chart
			if (mainContainer) {
				mainChart = createChart(mainContainer, {
					...chartOptions,
					width: mainContainer.clientWidth,
					height: mainContainer.clientHeight || 400
				});

				mainSeries = mainChart.addCandlestickSeries({
					upColor: '#22c55e',
					borderUpColor: '#22c55e',
					wickUpColor: '#22c55e',
					downColor: '#ef4444',
					borderDownColor: '#ef4444',
					wickDownColor: '#ef4444'
				});

				observer1 = new ResizeObserver(() => {
					mainChart?.applyOptions({
						width: mainContainer.clientWidth,
						height: mainContainer.clientHeight || 400
					});
				});
				observer1.observe(mainContainer);
			}

			// P&L area chart
			if (pnlContainer) {
				pnlChart = createChart(pnlContainer, {
					...chartOptions,
					width: pnlContainer.clientWidth,
					height: pnlContainer.clientHeight || 160
				});

				pnlSeries = pnlChart.addAreaSeries({
					lineColor: '#C9A84C',
					topColor: 'rgba(201,168,76,0.3)',
					bottomColor: 'rgba(201,168,76,0.02)',
					lineWidth: 2,
					crosshairMarkerVisible: true,
					priceFormat: {
						type: 'custom',
						formatter: (price: number) => `$${price.toFixed(2)}`
					}
				});

				observer2 = new ResizeObserver(() => {
					pnlChart?.applyOptions({
						width: pnlContainer.clientWidth,
						height: pnlContainer.clientHeight || 160
					});
				});
				observer2.observe(pnlContainer);
			}

			// Set initial timeframe
			if (availableTimeframes.length > 0 && !selectedTimeframe) {
				selectedTimeframe = availableTimeframes[0];
			}

			loading = false;
			renderFrame();
		});

		return () => {
			destroyed = true;
			clearTimer();
			observer1?.disconnect();
			observer2?.disconnect();
			mainChart?.remove();
			pnlChart?.remove();
		};
	});

	$effect(() => {
		if (mainSeries && allBars.length > 0) {
			void currentIndex;
			renderFrame();
		}
	});

	// Reset on timeframe change
	$effect(() => {
		if (currentContext?.timeframe && selectedTimeframe !== currentContext.timeframe) {
			selectedTimeframe = currentContext.timeframe;
		}
		if (currentContext) {
			pause();
			currentIndex = 0;
			if (slLine) { mainSeries?.removePriceLine(slLine); slLine = null; }
			if (tpLine) { mainSeries?.removePriceLine(tpLine); tpLine = null; }
			if (entryLine) { mainSeries?.removePriceLine(entryLine); entryLine = null; }
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col h-full min-h-[calc(100vh-8rem)]">
	<!-- Header -->
	<div class="flex-none px-4 py-3 border-b border-dark-border bg-dark-surface/50">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-3 min-w-0">
				<button
					type="button"
					onclick={() => goto(`/portfolio/trades/${$page.params.id}`)}
					class="text-sm text-gray-400 hover:text-white flex items-center gap-1 shrink-0"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
					<span class="hidden sm:inline">กลับ</span>
				</button>

				{#if trade}
					<div class="flex items-center gap-2 min-w-0">
						<h1 class="text-lg font-bold text-white">{trade.symbol}</h1>
						<span class="text-xs px-2 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
							{trade.type}
						</span>
						<span class="text-xs text-gray-500 hidden md:inline">
							{trade.lot_size} ล็อต
						</span>
					</div>

					<!-- Mobile info toggle -->
					<button
						type="button"
						onclick={() => showMobileInfo = !showMobileInfo}
						aria-label={showMobileInfo ? "ซ่อนข้อมูล" : "แสดงข้อมูล"}
						aria-expanded={showMobileInfo}
						class="md:hidden p-1.5 rounded-lg hover:bg-dark-hover text-gray-400"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</button>
				{/if}
			</div>

			{#if trade}
				<!-- Desktop trade info -->
				<div class="hidden md:flex items-center gap-4 text-sm">
					<div>
						<span class="text-gray-500">เข้า:</span>
						<span class="text-white ml-1">{formatNumber(trade.open_price, 5)}</span>
					</div>
					<div>
						<span class="text-gray-500">ออก:</span>
						<span class="text-white ml-1">{formatNumber(trade.close_price, 5)}</span>
					</div>
					{#if trade.sl}
						<div>
							<span class="text-gray-500">SL:</span>
							<span class="text-red-400 ml-1">{formatNumber(trade.sl, 5)}</span>
						</div>
					{/if}
					{#if trade.tp}
						<div>
							<span class="text-gray-500">TP:</span>
							<span class="text-green-400 ml-1">{formatNumber(trade.tp, 5)}</span>
						</div>
					{/if}
					<div class="font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(trade.profit)}
					</div>
				</div>
			{/if}
		</div>

		<!-- Mobile info panel -->
		{#if showMobileInfo && trade}
			<div class="md:hidden mt-3 grid grid-cols-2 gap-2 text-xs border-t border-dark-border pt-3">
				<div>
					<span class="text-gray-500">เข้า:</span>
					<span class="text-white ml-1">{formatNumber(trade.open_price, 5)}</span>
				</div>
				<div>
					<span class="text-gray-500">ออก:</span>
					<span class="text-white ml-1">{formatNumber(trade.close_price, 5)}</span>
				</div>
				{#if trade.sl}
					<div>
						<span class="text-gray-500">SL:</span>
						<span class="text-red-400 ml-1">{formatNumber(trade.sl, 5)}</span>
					</div>
				{/if}
				{#if trade.tp}
					<div>
						<span class="text-gray-500">TP:</span>
						<span class="text-green-400 ml-1">{formatNumber(trade.tp, 5)}</span>
					</div>
				{/if}
				<div>
					<span class="text-gray-500">P/L:</span>
					<span class="ml-1 font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(trade.profit)}</span>
				</div>
				<div>
					<span class="text-gray-500">ระยะเวลา:</span>
					<span class="text-white ml-1">{getDuration(trade.open_time, trade.close_time)}</span>
				</div>
			</div>
		{/if}
	</div>

	{#if !trade}
		<!-- Not found -->
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<div class="text-4xl text-gray-600 mb-3">
					<svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<p class="text-gray-500">ไม่พบ Trade นี้</p>
				<button
					type="button"
					onclick={() => goto('/portfolio/trades')}
					class="mt-4 text-sm text-brand-primary hover:text-brand-primary/80"
				>
					กลับไป Trade Explorer
				</button>
			</div>
		</div>
	{:else if chartContexts.length === 0}
		<!-- No chart data -->
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center max-w-sm">
				<div class="text-4xl text-gray-600 mb-3">
					<svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
					</svg>
				</div>
				<p class="text-gray-400 font-medium mb-1">ยังไม่มีข้อมูล Chart</p>
				<p class="text-gray-500 text-sm">Trade นี้ยังไม่มี chart context สำหรับ replay</p>
				<button
					type="button"
					onclick={() => goto(`/portfolio/trades/${$page.params.id}`)}
					class="mt-4 text-sm text-brand-primary hover:text-brand-primary/80"
				>
					กลับไปหน้า Trade Detail
				</button>
			</div>
		</div>
	{:else}
		<!-- Main content -->
		<div class="flex-1 flex flex-col min-h-0">
			<!-- Loading skeleton -->
			{#if loading}
				<div class="flex-1 flex flex-col gap-2 p-4">
					<div class="flex-1 rounded-xl bg-dark-border/20 animate-pulse"></div>
					<div class="h-32 rounded-xl bg-dark-border/20 animate-pulse"></div>
				</div>
			{/if}

			<!-- Status bar: current bar info + trade status -->
			<div class="flex-none px-4 py-2 border-b border-dark-border/50 text-xs" class:hidden={loading}>
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
					{#if currentBar}
						<span class="text-gray-400">{formatBarTime(currentBar.time)}</span>
						<span class="text-gray-500">O: <span class="text-white">{formatNumber(currentBar.open, 5)}</span></span>
						<span class="text-gray-500">H: <span class="text-white">{formatNumber(currentBar.high, 5)}</span></span>
						<span class="text-gray-500">L: <span class="text-white">{formatNumber(currentBar.low, 5)}</span></span>
						<span class="text-gray-500">C: <span class={currentBar.close >= currentBar.open ? 'text-green-400' : 'text-red-400'}>{formatNumber(currentBar.close, 5)}</span></span>
						<span class="text-gray-600">{currentIndex + 1}/{totalBars}</span>
					{/if}

					{#if hasReachedEntry && !hasReachedExit}
						<span class="px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-medium">กำลังเทรด</span>
						<span class={currentPnl >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
							P/L: {formatCurrency(currentPnl)}
						</span>
					{:else if hasReachedExit}
						<span class="px-2 py-0.5 rounded-full {trade.profit >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'} font-medium">
							ปิดแล้ว
						</span>
						<span class={trade.profit >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
							P/L: {formatCurrency(trade.profit)}
						</span>
					{:else}
						<span class="text-gray-500">ก่อนเข้าเทรด</span>
					{/if}

					{#if hasReachedEntry && pnlData.length > 0}
						<span class="hidden sm:inline text-gray-600">
							Max: <span class="text-green-400">{formatCurrency(maxPnl)}</span>
							Min: <span class="text-red-400">{formatCurrency(minPnl)}</span>
						</span>
					{/if}
				</div>
			</div>

			<!-- Charts area -->
			<div class="flex-1 flex flex-col min-h-0" class:hidden={loading}>
				<!-- Main candlestick chart -->
				<div class="flex-1 min-h-[250px]" bind:this={mainContainer}></div>

				<!-- P&L curve -->
				<div class="flex-none border-t border-dark-border/30">
					<div class="px-4 py-1 flex items-center justify-between">
						<span class="text-[10px] text-gray-500 uppercase tracking-wider">กำไร/ขาดทุนที่ยังไม่ปิด</span>
						{#if hasReachedEntry}
							<span class="text-xs font-medium {currentPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
								{formatCurrency(currentPnl)}
							</span>
						{/if}
					</div>
					<div class="h-[120px] sm:h-[140px]" bind:this={pnlContainer}></div>
				</div>
			</div>

			<!-- Controls bar -->
			<div class="flex-none px-4 py-3 border-t border-dark-border bg-dark-surface/30" class:hidden={loading}>
				<!-- Scrubber -->
				<input
					type="range"
					min="0"
					max={totalBars > 0 ? totalBars - 1 : 0}
					value={currentIndex}
					oninput={onScrub}
					disabled={totalBars <= 1}
					class="replay-scrubber w-full mb-3"
					style="background: linear-gradient(to right, #C9A84C {progressPercent}%, #262626 {progressPercent}%)"
				/>

				<div class="flex flex-wrap items-center justify-between gap-3">
					<!-- Transport controls -->
					<div class="flex items-center gap-1">
						<!-- Reset -->
						<button type="button" onclick={reset} class="ctrl-btn" title="รีเซ็ต (R)">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
							</svg>
						</button>

						<!-- Step backward -->
						<button type="button" onclick={stepBackward} disabled={currentIndex <= 0} class="ctrl-btn" title="ย้อนกลับ 1 แท่ง (←)">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
								<rect x="4" y="4" width="3" height="16" rx="1" />
								<path d="M18 4v16L8 12z" />
							</svg>
						</button>

						<!-- Play/Pause -->
						<button
							type="button"
							onclick={isPlaying ? pause : play}
							disabled={totalBars <= 1}
							class="p-2.5 rounded-xl text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
								{isPlaying ? 'bg-brand-primary/20 hover:bg-brand-primary/30 shadow-lg shadow-brand-primary/10' : 'bg-dark-surface hover:bg-dark-hover'}"
							title={isPlaying ? 'หยุดชั่วคราว (Space)' : 'เล่น (Space)'}
						>
							{#if isPlaying}
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
									<rect x="6" y="4" width="4" height="16" rx="1" />
									<rect x="14" y="4" width="4" height="16" rx="1" />
								</svg>
							{:else}
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
									<path d="M8 5v14l11-7z" />
								</svg>
							{/if}
						</button>

						<!-- Step forward -->
						<button type="button" onclick={stepForward} disabled={currentIndex >= totalBars - 1} class="ctrl-btn" title="ถัดไป 1 แท่ง (→)">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
								<path d="M6 4v16l10-8z" />
								<rect x="17" y="4" width="3" height="16" rx="1" />
							</svg>
						</button>
					</div>

					<!-- Jump buttons -->
					<div class="hidden sm:flex items-center gap-1.5">
						<button type="button" onclick={jumpToEntry} class="jump-btn" title="ไปที่จุดเข้า">
							<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
							จุดเข้า
						</button>
						<button type="button" onclick={jumpToExit} class="jump-btn" title="ไปที่จุดออก">
							จุดออก
							<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
						</button>
					</div>

					<!-- Speed + Timeframe -->
					<div class="flex items-center gap-3">
						<!-- Timeframe selector -->
						{#if availableTimeframes.length > 1}
							<div class="flex gap-0.5 bg-dark-bg/50 rounded-lg p-0.5">
								{#each availableTimeframes as tf}
									<button
										type="button"
										onclick={() => { selectedTimeframe = tf; }}
										class="px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200
											{selectedTimeframe === tf ? 'bg-dark-surface text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}"
									>
										{tf}
									</button>
								{/each}
							</div>
						{/if}

						<!-- Speed selector -->
						<div class="flex gap-0.5 bg-dark-bg/50 rounded-lg p-0.5">
							{#each SPEEDS as s}
								<button
									type="button"
									onclick={() => setSpeed(s)}
									class="px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200
										{speed === s ? 'bg-dark-surface text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-300'}"
								>
									{s}x
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Keyboard shortcuts hint -->
				<div class="hidden md:flex items-center gap-4 mt-2 text-[10px] text-gray-600">
					<span><kbd class="kbd">Space</kbd> เล่น/หยุด</span>
					<span><kbd class="kbd">&larr;</kbd><kbd class="kbd">&rarr;</kbd> เลื่อนทีละแท่ง</span>
					<span><kbd class="kbd">R</kbd> รีเซ็ต</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.replay-scrubber {
		-webkit-appearance: none;
		appearance: none;
		height: 6px;
		border-radius: 3px;
		outline: none;
		cursor: pointer;
	}
	.replay-scrubber:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.replay-scrubber::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #C9A84C;
		cursor: pointer;
		border: 2px solid #141414;
		box-shadow: 0 0 6px rgba(201,168,76,0.3);
	}
	.replay-scrubber::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #C9A84C;
		cursor: pointer;
		border: 2px solid #141414;
		box-shadow: 0 0 6px rgba(201,168,76,0.3);
	}
	.ctrl-btn {
		padding: 0.5rem;
		border-radius: 0.75rem;
		color: #9ca3af;
		transition: all 150ms;
	}
	.ctrl-btn:hover {
		background-color: rgba(55,65,81,0.3);
		color: white;
	}
	.ctrl-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.jump-btn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.625rem;
		border-radius: 0.5rem;
		font-size: 0.6875rem;
		color: #9ca3af;
		transition: all 150ms;
	}
	.jump-btn:hover {
		background-color: rgba(55,65,81,0.3);
		color: white;
	}
	.kbd {
		display: inline-block;
		padding: 0 0.25rem;
		border-radius: 0.25rem;
		border: 1px solid rgba(55,65,81,0.5);
		background-color: rgba(31,41,55,0.3);
		font-family: monospace;
		line-height: 1.5;
	}
</style>
