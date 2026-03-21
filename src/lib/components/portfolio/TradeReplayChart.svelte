<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';

	const BASE_INTERVAL_MS = 500;
	const SPEEDS = [0.5, 1, 2, 4] as const;

	let {
		contexts = [],
		trade,
		onclose
	}: {
		contexts?: any[];
		trade?: any;
		onclose?: () => void;
	} = $props();

	let container = $state<HTMLDivElement>(undefined!);
	let chart: any;
	let series: any;
	let slLine: any = null;
	let tpLine: any = null;
	let intervalId: ReturnType<typeof setInterval> | null = null;

	let isPlaying = $state(false);
	let speed = $state(1);
	let currentIndex = $state(0);
	let selectedTimeframe = $state('M5');

	let availableTimeframes = $derived(
		(contexts || []).map((c: any) => c.timeframe)
	);
	let currentContext = $derived(
		(contexts || []).find((c: any) => c.timeframe === selectedTimeframe) || contexts?.[0] || null
	);
	let allBars = $derived(
		(currentContext?.bars || []).map((bar: any) => ({
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

	function renderFrame() {
		if (!chart || !series || !allBars.length) return;

		series.setData(allBars.slice(0, currentIndex + 1));

		// Markers
		const markers: any[] = [];
		if (hasReachedEntry) {
			markers.push({
				time: entryTimestamp,
				position: 'belowBar',
				color: '#22c55e',
				shape: 'arrowUp',
				text: `Entry ${formatNumber(trade.open_price, 5)}`
			});
		}
		if (hasReachedExit) {
			markers.push({
				time: exitTimestamp,
				position: 'aboveBar',
				color: '#f97316',
				shape: 'arrowDown',
				text: `Exit ${formatNumber(trade.close_price, 5)}`
			});
		}
		series.setMarkers(markers);

		// SL/TP price lines
		if (hasReachedEntry) {
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
			if (slLine) {
				series.removePriceLine(slLine);
				slLine = null;
			}
			if (tpLine) {
				series.removePriceLine(tpLine);
				tpLine = null;
			}
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

	onMount(() => {
		let observer: ResizeObserver | undefined;
		let destroyed = false;

		import('lightweight-charts').then(({ createChart, ColorType }) => {
			if (destroyed || !container) return;

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
				height: 380,
				timeScale: {
					timeVisible: true,
					secondsVisible: false,
					borderColor: 'rgba(55,65,81,0.35)'
				},
				rightPriceScale: {
					borderColor: 'rgba(55,65,81,0.35)'
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

			observer = new ResizeObserver(() => {
				chart?.applyOptions({ width: container.clientWidth });
			});
			observer.observe(container);
			renderFrame();
		});

		return () => {
			destroyed = true;
			clearTimer();
			observer?.disconnect();
			chart?.remove();
		};
	});

	$effect(() => {
		// Re-render whenever currentIndex changes
		if (series && allBars.length > 0) {
			// Access currentIndex to track it
			void currentIndex;
			renderFrame();
		}
	});

	// Reset replay when timeframe changes
	$effect(() => {
		if (currentContext?.timeframe) {
			selectedTimeframe = currentContext.timeframe;
			pause();
			currentIndex = 0;
		}
	});
</script>

<div class="card space-y-4">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h3 class="text-sm font-medium text-white">Trade Replay</h3>
			<p class="text-xs text-gray-500">ดูการเคลื่อนไหวราคาทีละแท่ง</p>
		</div>
		<div class="flex items-center gap-2">
			{#if availableTimeframes.length > 0}
				<select
					bind:value={selectedTimeframe}
					class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
				>
					{#each availableTimeframes as timeframe}
						<option value={timeframe}>{timeframe}</option>
					{/each}
				</select>
			{/if}
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
		</div>
	</div>

	{#if currentContext && allBars.length > 0}
		<!-- Current bar info -->
		{#if currentBar}
			<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3 text-xs text-gray-400">
				<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
					<span>{formatBarTime(currentBar.time)}</span>
					<span>O: <span class="text-white">{formatNumber(currentBar.open, 5)}</span></span>
					<span>H: <span class="text-white">{formatNumber(currentBar.high, 5)}</span></span>
					<span>L: <span class="text-white">{formatNumber(currentBar.low, 5)}</span></span>
					<span>C: <span class={currentBar.close >= currentBar.open ? 'text-green-400' : 'text-red-400'}>{formatNumber(currentBar.close, 5)}</span></span>
					<span class="text-gray-500">{currentIndex + 1}/{totalBars}</span>
					{#if hasReachedEntry && !hasReachedExit}
						<span class="text-brand-primary font-medium">IN TRADE</span>
					{/if}
					{#if hasReachedExit}
						<span class={trade.profit >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
							P/L: {formatCurrency(trade.profit)}
						</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Chart -->
		<div bind:this={container} class="w-full"></div>

		<!-- Scrubber -->
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

		<!-- Controls -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-1.5">
				<!-- Reset -->
				<button
					type="button"
					onclick={reset}
					class="p-2 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors"
					title="รีเซ็ต"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h4l3-7 4 14 3-7h4" />
					</svg>
				</button>

				<!-- Play/Pause -->
				<button
					type="button"
					onclick={isPlaying ? pause : play}
					disabled={totalBars <= 1}
					class="p-2 rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed
						{isPlaying ? 'bg-brand-primary/20 hover:bg-brand-primary/30' : 'bg-dark-surface hover:bg-dark-hover'}"
					title={isPlaying ? 'Pause' : 'Play'}
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
					title="ถัดไป 1 แท่ง"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 4v16l10-8z" />
						<rect x="17" y="4" width="3" height="16" rx="1" />
					</svg>
				</button>
			</div>

			<!-- Speed selector -->
			<div class="flex gap-1 bg-dark-bg/50 rounded-lg p-1">
				{#each SPEEDS as s}
					<button
						type="button"
						onclick={() => setSpeed(s)}
						class="px-3 py-1 text-xs font-medium rounded-md transition-all duration-200
							{speed === s ? 'bg-dark-surface text-brand-primary shadow-sm' : 'text-gray-400 hover:text-gray-300'}"
					>
						{s}x
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="rounded-xl border border-dashed border-dark-border px-4 py-6 text-center text-sm text-gray-500">
			ยังไม่มี chart context สำหรับ trade นี้
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
