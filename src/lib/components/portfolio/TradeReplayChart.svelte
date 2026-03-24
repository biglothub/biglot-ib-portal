<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';
	import type { IChartApi, ISeriesApi, SeriesMarker, Time } from 'lightweight-charts';
	import type { Trade, TradeChartContext, TradeChartBar } from '$lib/types';

	const BASE_INTERVAL_MS = 500;
	const SPEEDS = [0.5, 1, 2, 5] as const;

	let {
		contexts = [],
		trade,
		onclose,
		fullscreen = false
	}: {
		contexts?: TradeChartContext[];
		trade?: Trade;
		onclose?: () => void;
		fullscreen?: boolean;
	} = $props();

	let container = $state<HTMLDivElement>(undefined!);
	let chart: IChartApi | null = null;
	let series: ISeriesApi<'Candlestick'> | null = null;
	let pnlSeries: ISeriesApi<'Line'> | null = null;
	let slLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null = null;
	let tpLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null = null;
	let intervalId: ReturnType<typeof setInterval> | null = null;

	let isPlaying = $state(false);
	let speed = $state(1);
	let currentIndex = $state(0);
	let selectedTimeframe = $state('M5');
	let showPnlOverlay = $state(true);

	let availableTimeframes = $derived(
		(contexts || []).map((c: TradeChartContext) => c.timeframe)
	);
	let currentContext = $derived(
		(contexts || []).find((c: TradeChartContext) => c.timeframe === selectedTimeframe) || contexts?.[0] || null
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

	// Compute unrealized P&L for each bar while in trade
	// Uses ratio-based scaling from actual trade profit for symbol-agnostic accuracy
	let pnlData = $derived.by(() => {
		if (!trade || !allBars.length) return [];
		const data: Array<{ time: number; value: number }> = [];
		const isBuy = trade.type === 'BUY';
		const entryPrice = Number(trade.open_price);
		const totalPriceDiff = isBuy
			? Number(trade.close_price) - entryPrice
			: entryPrice - Number(trade.close_price);

		for (let i = 0; i <= currentIndex; i++) {
			const bar = allBars[i];
			if (bar.time >= entryTimestamp) {
				if (bar.time >= exitTimestamp) {
					data.push({ time: bar.time, value: trade.profit });
				} else {
					const priceDiff = isBuy
						? bar.close - entryPrice
						: entryPrice - bar.close;
					const unrealizedPnl = Math.abs(totalPriceDiff) > 0
						? (priceDiff / totalPriceDiff) * Number(trade.profit)
						: 0;
					data.push({ time: bar.time, value: Math.round(unrealizedPnl * 100) / 100 });
				}
			}
		}
		return data;
	});

	// Current unrealized P&L
	let currentPnl = $derived(pnlData.length > 0 ? pnlData[pnlData.length - 1]?.value ?? 0 : 0);

	function renderFrame() {
		if (!chart || !series || !allBars.length) return;

		series.setData(
			allBars.slice(0, currentIndex + 1).map((b) => ({ ...b, time: b.time as unknown as Time }))
		);

		// Markers
		const markers: SeriesMarker<Time>[] = [];
		if (hasReachedEntry && trade) {
			markers.push({
				time: entryTimestamp as unknown as Time,
				position: trade.type === 'BUY' ? 'belowBar' : 'aboveBar',
				color: '#22c55e',
				shape: trade.type === 'BUY' ? 'arrowUp' : 'arrowDown',
				text: `Entry ${formatNumber(trade.open_price, 5)}`
			});
		}
		if (hasReachedExit && trade) {
			markers.push({
				time: exitTimestamp as unknown as Time,
				position: trade.type === 'BUY' ? 'aboveBar' : 'belowBar',
				color: '#f97316',
				shape: trade.type === 'BUY' ? 'arrowDown' : 'arrowUp',
				text: `Exit ${formatNumber(trade.close_price, 5)}`
			});
		}
		series.setMarkers(markers);

		// SL/TP price lines
		if (hasReachedEntry && trade) {
			if (!slLine && trade.sl) {
				slLine = series.createPriceLine({
					price: Number(trade.sl),
					color: '#ef4444',
					lineWidth: 1,
					lineStyle: 2,
					axisLabelVisible: true,
					title: 'SL'
				});
			}
			if (!tpLine && trade.tp) {
				tpLine = series.createPriceLine({
					price: Number(trade.tp),
					color: '#22c55e',
					lineWidth: 1,
					lineStyle: 2,
					axisLabelVisible: true,
					title: 'TP'
				});
			}
		} else {
			if (slLine && series) {
				series.removePriceLine(slLine);
				slLine = null;
			}
			if (tpLine && series) {
				series.removePriceLine(tpLine);
				tpLine = null;
			}
		}

		// P&L curve overlay
		if (pnlSeries && showPnlOverlay) {
			if (pnlData.length > 0) {
				pnlSeries.setData(
					pnlData.map((d) => ({
						time: d.time as unknown as Time,
						value: d.value
					}))
				);
			} else {
				pnlSeries.setData([]);
			}
		} else if (pnlSeries) {
			pnlSeries.setData([]);
		}

		chart.timeScale().fitContent();
	}

	function play() {
		if (totalBars <= 1) return;
		if (currentIndex >= totalBars - 1) currentIndex = 0;
		isPlaying = true;
		clearTimer();
		intervalId = setInterval(() => {
			if (currentIndex >= totalBars - 1) {
				pause();
				return;
			}
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
	}

	function stepForward() {
		pause();
		if (currentIndex < totalBars - 1) currentIndex++;
	}

	function stepBackward() {
		pause();
		if (currentIndex > 0) currentIndex--;
	}

	function skipToEntry() {
		pause();
		const entryIdx = allBars.findIndex((b) => b.time >= entryTimestamp);
		if (entryIdx >= 0) currentIndex = entryIdx;
	}

	function skipToExit() {
		pause();
		const exitIdx = allBars.findIndex((b) => b.time >= exitTimestamp);
		if (exitIdx >= 0) currentIndex = exitIdx;
	}

	function onScrub(e: Event) {
		pause();
		currentIndex = parseInt((e.target as HTMLInputElement).value);
	}

	function setSpeed(s: number) {
		speed = s;
		if (isPlaying) {
			clearTimer();
			intervalId = setInterval(() => {
				if (currentIndex >= totalBars - 1) {
					pause();
					return;
				}
				currentIndex++;
			}, BASE_INTERVAL_MS / speed);
		}
	}

	function clearTimer() {
		if (intervalId != null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function formatBarTime(unixSeconds: number): string {
		return new Date(unixSeconds * 1000).toLocaleString('th-TH', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
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
			case 'Home':
				e.preventDefault();
				reset();
				break;
			case 'End':
				e.preventDefault();
				pause();
				currentIndex = Math.max(0, totalBars - 1);
				break;
		}
	}

	onMount(() => {
		let observer: ResizeObserver | undefined;
		let destroyed = false;

		document.addEventListener('keydown', handleKeydown);

		import('lightweight-charts').then(({ createChart, ColorType, LineStyle }) => {
			if (destroyed || !container) return;

			const chartHeight = fullscreen ? 520 : 380;

			chart = createChart(container, {
				layout: {
					background: { type: ColorType.Solid, color: 'transparent' },
					textColor: '#9ca3af',
					fontFamily: "'Inter', sans-serif"
				},
				grid: {
					vertLines: { color: 'rgba(55,65,81,0.35)' },
					horzLines: { color: 'rgba(55,65,81,0.35)' }
				},
				width: container.clientWidth,
				height: chartHeight,
				timeScale: {
					timeVisible: true,
					secondsVisible: false,
					borderColor: 'rgba(55,65,81,0.35)'
				},
				rightPriceScale: {
					borderColor: 'rgba(55,65,81,0.35)'
				},
				crosshair: {
					mode: 0
				}
			});

			series = chart.addCandlestickSeries({
				upColor: '#22c55e',
				borderUpColor: '#22c55e',
				wickUpColor: '#22c55e',
				downColor: '#ef4444',
				borderDownColor: '#ef4444',
				wickDownColor: '#ef4444'
			});

			// P&L overlay line series on separate price scale
			pnlSeries = chart.addLineSeries({
				color: '#C9A84C',
				lineWidth: 2,
				priceScaleId: 'pnl',
				lastValueVisible: true,
				priceLineVisible: false,
				crosshairMarkerVisible: true,
				crosshairMarkerRadius: 4
			});

			chart.priceScale('pnl').applyOptions({
				scaleMargins: { top: 0.7, bottom: 0.05 },
				borderVisible: false,
				textColor: '#C9A84C',
				visible: showPnlOverlay
			});

			// Zero line for P&L
			pnlSeries.createPriceLine({
				price: 0,
				color: 'rgba(156,163,175,0.3)',
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				axisLabelVisible: false,
				title: ''
			});

			observer = new ResizeObserver(() => {
				chart?.applyOptions({ width: container.clientWidth });
			});
			observer.observe(container);
			renderFrame();
		});

		return () => {
			destroyed = true;
			clearTimer();
			document.removeEventListener('keydown', handleKeydown);
			observer?.disconnect();
			chart?.remove();
		};
	});

	$effect(() => {
		// Re-render whenever currentIndex or showPnlOverlay changes
		if (series && allBars.length > 0) {
			void currentIndex;
			void showPnlOverlay;
			renderFrame();
		}
	});

	// Toggle P&L scale visibility
	$effect(() => {
		if (chart) {
			chart.priceScale('pnl').applyOptions({
				visible: showPnlOverlay
			});
		}
	});

	// Reset replay when timeframe changes
	$effect(() => {
		void selectedTimeframe;
		if (currentContext) {
			pause();
			currentIndex = 0;
			// Remove old price lines
			if (slLine && series) {
				series.removePriceLine(slLine);
				slLine = null;
			}
			if (tpLine && series) {
				series.removePriceLine(tpLine);
				tpLine = null;
			}
		}
	});
</script>

<div class="card space-y-3 {fullscreen ? 'p-6' : ''}">
	<!-- Header -->
	<div class="flex items-start justify-between gap-3">
		<div>
			<h3 class="text-sm font-medium text-white flex items-center gap-2">
				Trade Replay
				{#if trade}
					<span class="text-xs font-normal px-2 py-0.5 rounded-full {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
						{trade.type}
					</span>
					<span class="text-xs font-normal text-gray-400">{trade.symbol}</span>
				{/if}
			</h3>
			<p class="text-xs text-gray-400 mt-0.5">ดูการเคลื่อนไหวราคาทีละแท่ง พร้อมกราฟ P&L</p>
		</div>
		<div class="flex items-center gap-2">
			{#if availableTimeframes.length > 0}
				<select
					bind:value={selectedTimeframe}
					class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
				>
					{#each availableTimeframes as timeframe}
						<option value={timeframe}>{timeframe}</option>
					{/each}
				</select>
			{/if}
			{#if onclose}
				<button
					type="button"
					onclick={onclose}
					class="p-1.5 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors"
					title="ปิด Replay"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	{#if currentContext && allBars.length > 0}
		<!-- Current bar info + trade status -->
		{#if currentBar}
			<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3 text-xs text-gray-400">
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
					<span>{formatBarTime(currentBar.time)}</span>
					<span>O: <span class="text-white">{formatNumber(currentBar.open, 5)}</span></span>
					<span>H: <span class="text-white">{formatNumber(currentBar.high, 5)}</span></span>
					<span>L: <span class="text-white">{formatNumber(currentBar.low, 5)}</span></span>
					<span>C: <span class={currentBar.close >= currentBar.open ? 'text-green-400' : 'text-red-400'}>{formatNumber(currentBar.close, 5)}</span></span>
					<span class="text-gray-400">{currentIndex + 1}/{totalBars}</span>
					{#if hasReachedEntry && !hasReachedExit}
						<span class="inline-flex items-center gap-1 text-brand-primary font-medium">
							<span class="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></span>
							IN TRADE
						</span>
						<span class={currentPnl >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
							P&L: {formatCurrency(currentPnl)}
						</span>
					{/if}
					{#if hasReachedExit && trade}
						<span class="text-gray-400 font-medium">CLOSED</span>
						<span class={trade.profit >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
							P&L: {formatCurrency(trade.profit)}
						</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Chart -->
		<div bind:this={container} class="w-full rounded-lg overflow-hidden"></div>

		<!-- Scrubber with entry/exit markers -->
		<div class="relative">
			{#if trade && totalBars > 1}
				{@const entryPercent = (() => {
					const idx = allBars.findIndex((b) => b.time >= entryTimestamp);
					return idx >= 0 ? (idx / (totalBars - 1)) * 100 : -1;
				})()}
				{@const exitPercent = (() => {
					const idx = allBars.findIndex((b) => b.time >= exitTimestamp);
					return idx >= 0 ? (idx / (totalBars - 1)) * 100 : -1;
				})()}
				{#if entryPercent >= 0}
					<div
						class="absolute top-0 w-px h-3 bg-green-500 z-10 pointer-events-none"
						style="left: {entryPercent}%"
					></div>
				{/if}
				{#if exitPercent >= 0}
					<div
						class="absolute top-0 w-px h-3 bg-orange-500 z-10 pointer-events-none"
						style="left: {exitPercent}%"
					></div>
				{/if}
			{/if}
			<input
				type="range"
				min="0"
				max={totalBars - 1}
				value={currentIndex}
				oninput={onScrub}
				disabled={totalBars <= 1}
				class="replay-scrubber w-full"
				style="background: linear-gradient(to right, #C9A84C {progressPercent}%, #262626 {progressPercent}%)"
			/>
		</div>

		<!-- Controls -->
		<div class="flex items-center justify-between flex-wrap gap-2">
			<div class="flex items-center gap-1">
				<!-- Reset -->
				<button
					type="button"
					onclick={reset}
					class="p-2 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors"
					title="รีเซ็ต (Home)"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M18 4v16l-10-8z" />
						<rect x="4" y="4" width="3" height="16" rx="1" />
					</svg>
				</button>

				<!-- Step backward -->
				<button
					type="button"
					onclick={stepBackward}
					disabled={currentIndex <= 0}
					class="p-2 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					title="ย้อนกลับ 1 แท่ง (←)"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M18 4v16l-10-8z" />
					</svg>
				</button>

				<!-- Play/Pause -->
				<button
					type="button"
					onclick={isPlaying ? pause : play}
					disabled={totalBars <= 1}
					class="p-2.5 rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed
						{isPlaying ? 'bg-brand-primary/20 hover:bg-brand-primary/30' : 'bg-dark-surface hover:bg-dark-hover'}"
					title={isPlaying ? 'หยุด (Space)' : 'เล่น (Space)'}
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
				<button
					type="button"
					onclick={stepForward}
					disabled={currentIndex >= totalBars - 1}
					class="p-2 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
					title="ถัดไป 1 แท่ง (→)"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 4v16l10-8z" />
					</svg>
				</button>

				<!-- Skip to end -->
				<button
					type="button"
					onclick={() => { pause(); currentIndex = Math.max(0, totalBars - 1); }}
					class="p-2 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors"
					title="ไปจุดสุดท้าย (End)"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 4v16l10-8z" />
						<rect x="17" y="4" width="3" height="16" rx="1" />
					</svg>
				</button>

				<!-- Divider -->
				<div class="w-px h-5 bg-dark-border mx-1"></div>

				<!-- Skip to entry -->
				<button
					type="button"
					onclick={skipToEntry}
					class="px-2 py-1 rounded text-xs text-green-400 hover:bg-green-500/10 transition-colors"
					title="ไปจุดเข้าเทรด"
				>
					Entry
				</button>

				<!-- Skip to exit -->
				<button
					type="button"
					onclick={skipToExit}
					class="px-2 py-1 rounded text-xs text-orange-400 hover:bg-orange-500/10 transition-colors"
					title="ไปจุดออกเทรด"
				>
					Exit
				</button>
			</div>

			<div class="flex items-center gap-3">
				<!-- P&L overlay toggle -->
				<button
					type="button"
					onclick={() => showPnlOverlay = !showPnlOverlay}
					class="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors
						{showPnlOverlay ? 'text-brand-primary bg-brand-primary/10' : 'text-gray-400 hover:text-gray-300'}"
					title="แสดง/ซ่อนกราฟ P&L"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
					</svg>
					P&L
				</button>

				<!-- Speed selector -->
				<div class="flex gap-0.5 bg-dark-bg/50 rounded-lg p-1">
					{#each SPEEDS as s}
						<button
							type="button"
							onclick={() => setSpeed(s)}
							class="px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200
								{speed === s ? 'bg-dark-surface text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
						>
							{s}x
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Keyboard shortcuts hint -->
		{#if fullscreen}
			<div class="text-center text-[10px] text-gray-400 pt-1">
				Space = เล่น/หยุด &nbsp; ← → = ย้อน/ถัดไป &nbsp; Home/End = เริ่มต้น/สุดท้าย
			</div>
		{/if}
	{:else}
		<div class="rounded-xl border border-dashed border-dark-border px-4 py-8 text-center">
			<svg class="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<p class="text-sm text-gray-400">ยังไม่มี chart context สำหรับ trade นี้</p>
			<p class="text-xs text-gray-400 mt-1">ข้อมูลกราฟจะถูกสร้างอัตโนมัติเมื่อ sync จาก MT5</p>
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
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #C9A84C;
		cursor: pointer;
		border: 2px solid #141414;
		transition: transform 0.15s ease;
	}
	.replay-scrubber::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}
	.replay-scrubber::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #C9A84C;
		cursor: pointer;
		border: 2px solid #141414;
	}
</style>
