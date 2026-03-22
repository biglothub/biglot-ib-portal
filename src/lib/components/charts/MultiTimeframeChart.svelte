<script lang="ts">
	import { formatNumber } from '$lib/utils';
	import type { IChartApi, ISeriesApi, SeriesMarker, Time, MouseEventParams } from 'lightweight-charts';
	import type { Trade } from '$lib/types';

	interface Bar {
		time: number;
		open: number;
		high: number;
		low: number;
		close: number;
	}

	interface ChartContext {
		timeframe: string;
		bars: Bar[];
		window_start: string;
		window_end: string;
	}

	interface ChartInstance {
		chart: IChartApi | null;
		series: ISeriesApi<'Candlestick'> | null;
		tf: string;
	}

	let {
		contexts = [],
		trade
	}: {
		contexts?: ChartContext[];
		trade: Trade;
	} = $props();

	// Timeframe display labels
	const TF_LABELS: Record<string, string> = {
		M1: '1m',
		M5: '5m',
		M15: '15m',
		M30: '30m',
		H1: '1H',
		H4: '4H',
		D1: 'D',
		W1: 'W',
		MN1: 'M'
	};

	const TF_ORDER = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];

	const sortedContexts = $derived(
		[...contexts].sort((a, b) => {
			const ai = TF_ORDER.indexOf(a.timeframe);
			const bi = TF_ORDER.indexOf(b.timeframe);
			return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
		})
	);

	let focusedTf = $state<string | null>(null);

	// Shared crosshair sync state — plain array, one per component instance
	const instances: ChartInstance[] = [];
	let isSyncing = false;

	function syncCrosshair(fromChart: IChartApi, time: unknown) {
		if (isSyncing) return;
		isSyncing = true;
		instances.forEach(({ chart, series }) => {
			if (!chart || chart === fromChart) return;
			try {
				if (time !== undefined && time !== null && series) {
					chart.setCrosshairPosition(0, time as import('lightweight-charts').Time, series);
				} else {
					chart.clearCrosshairPosition();
				}
			} catch {
				// ignore if chart is not ready
			}
		});
		isSyncing = false;
	}

	// Svelte action: initialises a lightweight-charts candlestick chart inside `container`
	function chartPanel(container: HTMLDivElement, ctx: ChartContext) {
		let chart: IChartApi | null = null;
		let series: ISeriesApi<'Candlestick'> | null = null;
		let instance: ChartInstance | null = null;
		let ro: ResizeObserver | null = null;
		let destroyed = false;

		import('lightweight-charts').then(({ createChart, ColorType, LineStyle }) => {
			if (destroyed || !container) return;

			chart = createChart(container, {
				layout: {
					background: { type: ColorType.Solid, color: 'transparent' },
					textColor: '#9CA3AF',
					fontFamily: "'Inter', sans-serif"
				},
				grid: {
					vertLines: { color: 'rgba(55,65,81,0.4)' },
					horzLines: { color: 'rgba(55,65,81,0.4)' }
				},
				width: container.clientWidth,
				height: container.clientHeight || 240,
				timeScale: {
					timeVisible: true,
					secondsVisible: false,
					borderColor: 'rgba(55,65,81,0.5)',
					rightOffset: 5
				},
				rightPriceScale: {
					borderColor: 'rgba(55,65,81,0.5)',
					scaleMargins: { top: 0.1, bottom: 0.1 }
				},
				crosshair: {
					mode: 1,
					vertLine: {
						color: 'rgba(201,168,76,0.7)',
						width: 1,
						style: LineStyle.Dashed,
						labelBackgroundColor: '#1F2937'
					},
					horzLine: {
						color: 'rgba(201,168,76,0.7)',
						width: 1,
						style: LineStyle.Dashed,
						labelBackgroundColor: '#1F2937'
					}
				},
				handleScroll: { mouseWheel: true, pressedMouseMove: true },
				handleScale: { mouseWheel: true, pinch: true }
			});

			series = chart.addCandlestickSeries({
				upColor: '#10B981',
				borderUpColor: '#10B981',
				wickUpColor: '#10B981',
				downColor: '#EF4444',
				borderDownColor: '#EF4444',
				wickDownColor: '#EF4444'
			});

			const bars = (ctx.bars || []).map((b: Bar) => ({
				time: b.time as any,
				open: b.open,
				high: b.high,
				low: b.low,
				close: b.close
			}));
			series.setData(bars);

			// Entry / exit markers
			const entryTime = Math.floor(new Date(trade.open_time).getTime() / 1000);
			const exitTime = Math.floor(new Date(trade.close_time).getTime() / 1000);
			const markers: SeriesMarker<Time>[] = [];
			if (entryTime) {
				markers.push({
					time: entryTime as any,
					position: 'belowBar',
					color: '#22c55e',
					shape: 'arrowUp',
					text: `Entry ${formatNumber(trade.open_price, 5)}`
				});
			}
			if (exitTime) {
				markers.push({
					time: exitTime as any,
					position: 'aboveBar',
					color: '#f97316',
					shape: 'arrowDown',
					text: `Exit ${formatNumber(trade.close_price, 5)}`
				});
			}
			series.setMarkers(markers);

			if (trade.sl) {
				series.createPriceLine({
					price: Number(trade.sl),
					color: '#ef4444',
					lineWidth: 1,
					lineStyle: LineStyle.Dashed,
					axisLabelVisible: true,
					title: 'SL'
				});
			}
			if (trade.tp) {
				series.createPriceLine({
					price: Number(trade.tp),
					color: '#22c55e',
					lineWidth: 1,
					lineStyle: LineStyle.Dashed,
					axisLabelVisible: true,
					title: 'TP'
				});
			}

			chart.timeScale().fitContent();

			// Register for crosshair sync
			instance = { chart, series, tf: ctx.timeframe };
			instances.push(instance);

			chart.subscribeCrosshairMove((param: MouseEventParams) => {
				if (chart) syncCrosshair(chart, param?.time);
			});

			// Respond to container size changes (grid ↔ focus toggle resizes the DOM)
			ro = new ResizeObserver(() => {
				if (chart && container) {
					chart.applyOptions({
						width: container.clientWidth,
						height: container.clientHeight || 240
					});
					chart.timeScale().fitContent();
				}
			});
			ro.observe(container);
		});

		return {
			destroy() {
				destroyed = true;
				ro?.disconnect();
				chart?.remove();
				if (instance) {
					const idx = instances.indexOf(instance);
					if (idx >= 0) instances.splice(idx, 1);
				}
			}
		};
	}

	function tfLabel(tf: string): string {
		return TF_LABELS[tf] ?? tf;
	}
</script>

<div class="card space-y-3">
	<!-- Header -->
	<div class="flex items-center justify-between gap-3">
		<div>
			<h3 class="text-sm font-medium text-white">การวิเคราะห์หลายกรอบเวลา</h3>
			<p class="text-xs text-gray-500 mt-0.5">
				Entry/exit markers พร้อม crosshair ซิงก์ทุก timeframe
			</p>
		</div>

		{#if focusedTf !== null}
			<button
				type="button"
				onclick={() => (focusedTf = null)}
				class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors bg-dark-bg/60 border border-dark-border rounded-lg px-3 py-1.5"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
					/>
				</svg>
				ดูทั้งหมด
			</button>
		{/if}
	</div>

	<!-- Empty state -->
	{#if sortedContexts.length === 0}
		<div class="rounded-xl border border-dashed border-dark-border px-4 py-8 text-center">
			<svg
				class="w-10 h-10 mx-auto mb-2 text-gray-600"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
				/>
			</svg>
			<p class="text-sm text-gray-500">ยังไม่มีข้อมูล Chart Context สำหรับ Trade นี้</p>
			<p class="text-xs text-gray-600 mt-1">ข้อมูลจะแสดงเมื่อ Bridge ส่ง bar data มา</p>
		</div>

	<!-- Timeframe tabs when focused -->
	{:else if focusedTf !== null}
		{@const ctx = sortedContexts.find((c) => c.timeframe === focusedTf) ?? sortedContexts[0]}

		<!-- Timeframe pill tabs -->
		<div class="flex flex-wrap gap-1.5">
			{#each sortedContexts as c}
				<button
					type="button"
					onclick={() => (focusedTf = c.timeframe)}
					class="px-3 py-1 rounded-md text-xs font-medium transition-all duration-150
						{focusedTf === c.timeframe
							? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40'
							: 'bg-dark-bg/60 text-gray-400 border border-dark-border hover:text-gray-300 hover:border-gray-500'}"
				>
					{tfLabel(c.timeframe)}
				</button>
			{/each}
		</div>

		<!-- Focused chart -->
		<div class="rounded-xl border border-dark-border bg-dark-bg/20 overflow-hidden">
			<div class="flex items-center justify-between px-3 py-2 border-b border-dark-border/60">
				<span
					class="text-xs font-semibold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded"
				>
					{tfLabel(ctx.timeframe)}
				</span>
				<span class="text-xs text-gray-500">
					{ctx.bars?.length ?? 0} แท่ง · {new Date(ctx.window_start).toLocaleDateString('th-TH')}
					— {new Date(ctx.window_end).toLocaleDateString('th-TH')}
				</span>
			</div>
			<!-- Bind height via CSS; ResizeObserver handles chart resize -->
			<div
				class="w-full"
				style="height: 380px;"
				use:chartPanel={ctx}
			></div>
		</div>

	<!-- Grid mode (default) -->
	{:else}
		<div
			class="grid gap-3"
			class:grid-cols-1={sortedContexts.length === 1}
			class:grid-cols-2={sortedContexts.length > 1}
		>
			{#each sortedContexts as ctx}
				<div class="rounded-xl border border-dark-border bg-dark-bg/20 overflow-hidden group">
					<!-- Panel header -->
					<div class="flex items-center justify-between px-3 py-2 border-b border-dark-border/60">
						<span
							class="text-xs font-semibold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded"
						>
							{tfLabel(ctx.timeframe)}
						</span>
						<div class="flex items-center gap-2">
							<span class="text-xs text-gray-600 hidden sm:block">
								{ctx.bars?.length ?? 0} แท่ง
							</span>
							<button
								type="button"
								onclick={() => (focusedTf = ctx.timeframe)}
								title="ขยาย"
								class="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
									/>
								</svg>
							</button>
						</div>
					</div>

					<!-- Chart container: height controlled by CSS; ResizeObserver handles chart sizing -->
					<div
						class="w-full"
						style="height: {sortedContexts.length <= 2 ? '280' : '220'}px;"
						use:chartPanel={ctx}
					></div>
				</div>
			{/each}
		</div>

		<!-- Sync indicator -->
		{#if sortedContexts.length > 1}
			<p class="text-xs text-gray-600 text-right">
				↔ Crosshair ซิงก์ทุก {sortedContexts.length} timeframe · คลิก ⤢ เพื่อขยาย
			</p>
		{/if}
	{/if}
</div>
