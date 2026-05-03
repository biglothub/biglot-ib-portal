<script lang="ts">
	import { onMount } from 'svelte';
	import { formatCurrency } from '$lib/utils';
	import type { IChartApi, ISeriesApi, MouseEventParams } from 'lightweight-charts';

	let {
		equitySnapshots = [],
		equityCurve = [],
		height = 280,
		loading = false
	}: {
		equitySnapshots?: Array<{ time: number; balance: number; equity: number; floatingPL: number }>;
		equityCurve?: number[];
		height?: number;
		loading?: boolean;
	} = $props();

	let chartContainer = $state<HTMLDivElement>(undefined!);
	let drawdownContainer = $state<HTMLDivElement>(undefined!);
	let chart: IChartApi | null = null;
	let drawdownChart: IChartApi | null = null;
	let equitySeries: ISeriesApi<'Line'> | null = null;
	let balanceSeries: ISeriesApi<'Line'> | null = null;
	let floatingZoneSeries: ISeriesApi<'Area'> | null = null;
	let drawdownSeries: ISeriesApi<'Area'> | null = null;

	let currentTimeframe = $state('1M');
	let showDrawdown = $state(true);
	let dropdownOpen = $state(false);
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipData = $state<any>(null);

	const THAILAND_OFFSET_SECONDS = 7 * 3600;

	const timeframes = [
		{ label: '1D', days: 1 },
		{ label: '1W', days: 7 },
		{ label: '1M', days: 30 },
		{ label: '3M', days: 90 },
		{ label: '6M', days: 180 },
		{ label: '1Y', days: 365 }
	];

	const selectedDays = $derived(timeframes.find(t => t.label === currentTimeframe)?.days || 30);
	const hasAnyData = $derived((equitySnapshots?.length || 0) > 0 || (equityCurve?.length || 0) > 0);
	const currentRangeData = $derived(getFilteredData(selectedDays));
	const hasRangeData = $derived(currentRangeData.length > 0);

	// Running peak-to-equity drawdown (MyFxbook-style underwater curve)
	const drawdownSeriesData = $derived.by(() => {
		if (currentRangeData.length === 0) return [];
		let peak = currentRangeData[0].equity;
		return currentRangeData.map(d => {
			if (d.equity > peak) peak = d.equity;
			const ddPct = peak > 0 ? ((d.equity - peak) / peak) * 100 : 0;
			return { time: d.time, value: ddPct };
		});
	});

	const maxDrawdownPct = $derived(
		drawdownSeriesData.length ? Math.min(0, ...drawdownSeriesData.map(d => d.value)) : 0
	);

	function getFilteredData(days: number) {
		const now = Math.floor(Date.now() / 1000);
		const cutoff = now - days * 86400;

		if (!equitySnapshots || equitySnapshots.length === 0) {
			if (equityCurve && equityCurve.length > 0) {
				const todayMidnightUTC = Math.floor(Date.now() / 1000 / 86400) * 86400;
				const dailyData = equityCurve.map((eq, i) => ({
					time: todayMidnightUTC - (equityCurve.length - 1 - i) * 86400,
					equity: eq,
					balance: eq,
					floatingPL: 0
				}));
				return dailyData.filter(d => d.time >= cutoff);
			}
			return [];
		}

		return equitySnapshots
			.filter(s => s.time >= cutoff)
			.sort((a, b) => a.time - b.time);
	}

	function updateChartData() {
		if (!chart || !equitySeries || !balanceSeries) return;

		const data = currentRangeData;

		if (data.length === 0) {
			equitySeries.setData([]);
			balanceSeries.setData([]);
			if (floatingZoneSeries) floatingZoneSeries.setData([]);
			tooltipVisible = false;
			return;
		}

		const eqData = data.map(d => ({
			time: (d.time + THAILAND_OFFSET_SECONDS) as any,
			value: d.equity
		}));
		const balData = data.map(d => ({
			time: (d.time + THAILAND_OFFSET_SECONDS) as any,
			value: d.balance
		}));

		equitySeries.setData(eqData);
		balanceSeries.setData(balData);

		const zoneData = data.map(d => ({
			time: (d.time + THAILAND_OFFSET_SECONDS) as any,
			value: d.equity,
			color: d.floatingPL >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
		}));
		if (floatingZoneSeries) floatingZoneSeries.setData(zoneData);

		if (drawdownSeries) {
			const ddData = drawdownSeriesData.map(d => ({
				time: (d.time + THAILAND_OFFSET_SECONDS) as any,
				value: d.value
			}));
			drawdownSeries.setData(ddData);
		}

		chart.timeScale().fitContent();
	}

	function selectTimeframe(tf: string) {
		currentTimeframe = tf;
	}

	function formatMoney(value: number): string {
		return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp * 1000);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: 'UTC'
		});
	}

	onMount(() => {
		let resizeObserver: ResizeObserver | undefined;
		let destroyed = false;

		const intersectionObserver = new IntersectionObserver((entries) => {
			if (!entries[0].isIntersecting) return;
			intersectionObserver.disconnect();

			import('lightweight-charts').then(({ createChart, ColorType, LineStyle }) => {
				if (destroyed || !chartContainer) return;

				chart = createChart(chartContainer, {
					layout: {
						background: { type: ColorType.Solid, color: 'transparent' },
						textColor: '#b8ad94',
						fontFamily: "'Inter', sans-serif"
					},
					grid: {
						vertLines: { color: 'rgba(245, 241, 227, 0.10)', style: LineStyle.Dotted },
						horzLines: { color: 'rgba(245, 241, 227, 0.10)', style: LineStyle.Dotted }
					},
					width: chartContainer.clientWidth,
					height,
					rightPriceScale: {
						borderColor: 'rgba(245, 241, 227, 0.10)',
						scaleMargins: { top: 0.1, bottom: 0.1 }
					},
					timeScale: {
						borderColor: 'rgba(245, 241, 227, 0.10)',
						timeVisible: true,
						secondsVisible: false,
						rightOffset: 5
					},
					crosshair: {
						mode: 1,
						vertLine: { color: 'rgba(201, 168, 76, 0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' },
						horzLine: { color: 'rgba(201, 168, 76, 0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' }
					},
					handleScroll: { mouseWheel: true, pressedMouseMove: true },
					handleScale: { mouseWheel: true, pinch: true }
				});

				floatingZoneSeries = chart.addAreaSeries({
					lineColor: 'transparent',
					topColor: 'rgba(16, 185, 129, 0.15)',
					bottomColor: 'rgba(239, 68, 68, 0.15)',
					lineWidth: 0 as unknown as import('lightweight-charts').LineWidth,
					crosshairMarkerVisible: false
				});

				balanceSeries = chart.addLineSeries({
					color: '#6B7280',
					lineWidth: 2,
					lineStyle: LineStyle.Solid,
					crosshairMarkerVisible: true,
					crosshairMarkerRadius: 4,
					crosshairMarkerBorderColor: '#6B7280',
					crosshairMarkerBackgroundColor: '#1F2937',
					title: 'Balance'
				});

				equitySeries = chart.addLineSeries({
					color: '#C9A84C',
					lineWidth: 3,
					lineStyle: LineStyle.Solid,
					crosshairMarkerVisible: true,
					crosshairMarkerRadius: 5,
					crosshairMarkerBorderColor: '#C9A84C',
					crosshairMarkerBackgroundColor: '#1F2937',
					title: 'Equity',
					lastValueVisible: true,
					priceLineVisible: true,
					priceLineColor: '#C9A84C',
					priceLineStyle: LineStyle.Dashed
				});

				chart.subscribeCrosshairMove((param: MouseEventParams) => {
					if (!param || !param.time || !param.point) {
						tooltipVisible = false;
						return;
					}
					const eqVal = equitySeries ? param.seriesData.get(equitySeries) as { value?: number } | undefined : undefined;
					const balVal = balanceSeries ? param.seriesData.get(balanceSeries) as { value?: number } | undefined : undefined;
					if (eqVal && eqVal.value !== undefined && balVal && balVal.value !== undefined) {
						tooltipVisible = true;
						tooltipX = param.point.x;
						tooltipY = param.point.y;
						tooltipData = {
							time: param.time,
							equity: eqVal.value,
							balance: balVal.value,
							floatingPL: eqVal.value - balVal.value
						};
					}
				});

				// Drawdown pane (MyFxbook-style underwater curve) — synced time scale
				if (drawdownContainer) {
					drawdownChart = createChart(drawdownContainer, {
						layout: {
							background: { type: ColorType.Solid, color: 'transparent' },
							textColor: '#b8ad94',
							fontFamily: "'Inter', sans-serif"
						},
						grid: {
							vertLines: { color: 'rgba(245, 241, 227, 0.08)', style: LineStyle.Dotted },
							horzLines: { color: 'rgba(245, 241, 227, 0.08)', style: LineStyle.Dotted }
						},
						width: drawdownContainer.clientWidth,
						height: 110,
						rightPriceScale: {
							borderColor: 'rgba(245, 241, 227, 0.10)',
							scaleMargins: { top: 0.1, bottom: 0.05 }
						},
						timeScale: {
							borderColor: 'rgba(245, 241, 227, 0.10)',
							timeVisible: true,
							secondsVisible: false,
							rightOffset: 5
						},
						crosshair: {
							mode: 1,
							vertLine: { color: 'rgba(239, 68, 68, 0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' },
							horzLine: { color: 'rgba(239, 68, 68, 0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#1F2937' }
						},
						handleScroll: { mouseWheel: true, pressedMouseMove: true },
						handleScale: { mouseWheel: true, pinch: true }
					});

					drawdownSeries = drawdownChart.addAreaSeries({
						lineColor: '#EF4444',
						topColor: 'rgba(239, 68, 68, 0.05)',
						bottomColor: 'rgba(239, 68, 68, 0.45)',
						lineWidth: 2,
						priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(2)}%` },
						title: 'Drawdown'
					});

					// Sync time scale: when top chart pans/zooms, move drawdown to match
					let syncing = false;
					chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
						if (syncing || !range || !drawdownChart) return;
						syncing = true;
						drawdownChart.timeScale().setVisibleLogicalRange(range);
						syncing = false;
					});
					drawdownChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
						if (syncing || !range || !chart) return;
						syncing = true;
						chart.timeScale().setVisibleLogicalRange(range);
						syncing = false;
					});
				}

				resizeObserver = new ResizeObserver(() => {
					chart?.applyOptions({ width: chartContainer.clientWidth });
					if (drawdownContainer) {
						drawdownChart?.applyOptions({ width: drawdownContainer.clientWidth });
					}
				});
				resizeObserver.observe(chartContainer);

				updateChartData();
			});
		}, { threshold: 0.05 });

		intersectionObserver.observe(chartContainer);

		return () => {
			destroyed = true;
			intersectionObserver.disconnect();
			resizeObserver?.disconnect();
			chart?.remove();
			chart = null;
			drawdownChart?.remove();
			drawdownChart = null;
		};
	});

	$effect(() => {
		// Re-run when timeframe or data changes
		if (equitySnapshots || equityCurve || currentTimeframe) {
			updateChartData();
		}
	});
</script>

<div class="w-full" aria-busy={loading} aria-label="การเติบโตของ Equity">
	{#if loading}
		<div class="animate-pulse">
			<div class="flex items-center justify-between mb-4">
				<div class="h-5 w-40 bg-dark-surface rounded"></div>
				<div class="h-7 w-44 bg-dark-surface rounded-lg"></div>
			</div>
			<div class="bg-dark-surface rounded-lg overflow-hidden" style:height="{height}px">
				<div class="h-full w-full flex flex-col justify-end px-4 pb-4 gap-3">
					<div class="flex items-end gap-1 h-3/4">
						{#each [0.6, 0.8, 0.5, 0.9, 0.7, 1, 0.85, 0.75, 0.95, 0.65] as pct}
							<div class="flex-1 bg-gray-700/40 rounded-t" style:height="{pct * 100}%"></div>
						{/each}
					</div>
					<div class="h-3 w-full bg-gray-700/30 rounded"></div>
				</div>
			</div>
			<div class="grid grid-cols-3 gap-3 mt-4">
				{#each [1, 2, 3] as _}
					<div class="bg-dark-surface rounded-lg p-3">
						<div class="h-2.5 w-14 bg-gray-700/50 rounded mb-2"></div>
						<div class="h-4 w-20 bg-gray-700/40 rounded"></div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-3">
			<h3 class="text-lg font-semibold text-white">การเติบโตของ Equity</h3>
			<div class="flex items-center gap-4 text-xs">
				<div class="flex items-center gap-1.5">
					<span class="w-3 h-0.5 bg-brand-primary rounded"></span>
					<span class="text-gray-400">Equity</span>
				</div>
				<div class="flex items-center gap-1.5">
					<span class="w-3 h-0.5 bg-gray-500 rounded"></span>
					<span class="text-gray-400">Balance</span>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-3 ml-4">
		<!-- Drawdown toggle (MyFxbook-style underwater pane) -->
		<button
			class="px-1.5 py-1 text-[10px] font-medium rounded border transition-all duration-200
				{showDrawdown
					? 'bg-red-500/10 text-red-400 border-red-500/40'
					: 'bg-dark-surface text-gray-400 border-dark-border hover:border-red-500/40'}"
			onclick={() => showDrawdown = !showDrawdown}
			title="Toggle drawdown pane"
		>
			DD
		</button>

		<!-- Timeframe Selector Dropdown -->
		<div class="relative">
			<button
				class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-dark-surface text-brand-primary border border-dark-border hover:border-brand-primary/50 transition-all duration-200"
				onclick={() => dropdownOpen = !dropdownOpen}
				onblur={() => setTimeout(() => dropdownOpen = false, 150)}
			>
				{currentTimeframe}
				<svg class="w-3 h-3 transition-transform duration-200 {dropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{#if dropdownOpen}
				<div class="absolute right-0 top-full mt-1 z-50 bg-dark-surface border border-dark-border rounded-lg shadow-xl overflow-hidden min-w-[80px]">
					{#each timeframes as tf}
						<button
							class="w-full px-3 py-1.5 text-xs font-medium text-left transition-colors duration-150
								{currentTimeframe === tf.label
								? 'text-brand-primary bg-brand-primary/10'
								: 'text-gray-400 hover:text-white hover:bg-dark-bg/50'}"
							onmousedown={() => { selectTimeframe(tf.label); dropdownOpen = false; }}
						>
							{tf.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		</div>
	</div>

	<!-- Chart Container -->
	<div class="relative">
		<div
			bind:this={chartContainer}
			class="w-full h-72 bg-dark-bg/30 rounded-lg overflow-hidden"
		></div>

		<!-- Custom Tooltip -->
		{#if tooltipVisible && tooltipData}
			<div
				class="absolute pointer-events-none z-50 bg-gray-900/95 text-white text-xs rounded-xl py-3 px-4 shadow-xl backdrop-blur-sm border border-gray-700/50 min-w-[180px] transition-all duration-150"
				style="left: {Math.min(tooltipX + 15, (chartContainer?.clientWidth || 0) - 200)}px; top: {Math.max(tooltipY - 80, 10)}px;"
			>
				<div class="text-gray-400 text-[10px] uppercase tracking-wide mb-2">
					{formatDate(tooltipData.time)}
				</div>
				<div class="flex items-center justify-between mb-1.5">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 bg-brand-primary rounded-full"></span>
						<span class="text-gray-300">Equity</span>
					</div>
					<span class="font-mono font-semibold text-white">${formatMoney(tooltipData.equity)}</span>
				</div>
				<div class="flex items-center justify-between mb-1.5">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 bg-gray-500 rounded-full"></span>
						<span class="text-gray-300">Balance</span>
					</div>
					<span class="font-mono font-medium text-gray-200">${formatMoney(tooltipData.balance)}</span>
				</div>
				<div class="flex items-center justify-between pt-1.5 border-t border-gray-700/50">
					<span class="text-gray-400">Floating P/L</span>
					<span class="font-mono font-semibold {tooltipData.floatingPL >= 0 ? 'text-green-400' : 'text-red-400'}">
						{tooltipData.floatingPL >= 0 ? '+' : ''}{formatMoney(tooltipData.floatingPL)}
					</span>
				</div>
			</div>
		{/if}

		<!-- Drawdown pane (synced) -->
		<div
			bind:this={drawdownContainer}
			class="w-full bg-dark-bg/20 rounded-lg overflow-hidden mt-2 transition-all duration-200"
			style:height={showDrawdown ? '110px' : '0px'}
			style:opacity={showDrawdown ? '1' : '0'}
			style:margin-top={showDrawdown ? '0.5rem' : '0'}
			aria-hidden={!showDrawdown}
		></div>

		<!-- No Data State -->
		{#if !hasAnyData}
			<div class="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
				<svg class="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
				</svg>
				<span class="text-sm">ยังไม่มีข้อมูล Equity</span>
				<span class="text-xs text-gray-400 mt-1">ข้อมูลจะแสดงเมื่อมีการเทรด</span>
			</div>
		{:else if !hasRangeData}
			<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
				ไม่พบข้อมูลสำหรับช่วง {currentTimeframe}
			</div>
		{/if}
	</div>

	<!-- Stats Summary -->
	{#if currentRangeData.length > 0}
		{@const latest = currentRangeData[currentRangeData.length - 1]}
		{@const first = currentRangeData[0]}
		{@const growth = first?.equity ? ((latest.equity - first.equity) / first.equity) * 100 : 0}
		{@const maxEquity = currentRangeData.reduce((max, d) => d.equity > max ? d.equity : max, -Infinity)}

		<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
			<div class="min-w-0 bg-dark-bg/30 rounded-lg px-2 py-2.5 text-center">
				<div class="text-[10px] text-gray-400 mb-0.5">Current</div>
				<div class="font-mono font-semibold text-white text-xs truncate" title="${formatMoney(latest.equity)}">${formatMoney(latest.equity)}</div>
			</div>
			<div class="min-w-0 bg-dark-bg/30 rounded-lg px-2 py-2.5 text-center">
				<div class="text-[10px] text-gray-400 mb-0.5">Growth</div>
				<div class="font-mono font-semibold text-xs truncate {growth >= 0 ? 'text-green-400' : 'text-red-400'}">
					{growth >= 0 ? '+' : ''}{growth.toFixed(2)}%
				</div>
			</div>
			<div class="min-w-0 bg-dark-bg/30 rounded-lg px-2 py-2.5 text-center">
				<div class="text-[10px] text-gray-400 mb-0.5">Peak</div>
				<div class="font-mono font-semibold text-brand-primary text-xs truncate" title="${formatMoney(maxEquity)}">${formatMoney(maxEquity)}</div>
			</div>
			<div class="min-w-0 bg-dark-bg/30 rounded-lg px-2 py-2.5 text-center">
				<div class="text-[10px] text-gray-400 mb-0.5">Max DD</div>
				<div class="font-mono font-semibold text-red-400 text-xs truncate">
					{maxDrawdownPct.toFixed(2)}%
				</div>
			</div>
		</div>
	{/if}
	{/if}
</div>
