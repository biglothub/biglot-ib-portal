<script lang="ts">
	import { formatCurrency } from '$lib/utils';

	let {
		drawdownData = [],
		intradayData = null
	}: {
		drawdownData?: { date: string; drawdownPct: number }[];
		intradayData?: {
			maxDrawdownPct: number;
			absoluteDrawdown: number;
			peakEquity: number;
			lowestEquity: number;
			history: { time: number; drawdownPct: number }[];
		} | null;
	} = $props();

	// Use intraday when available and meaningful
	const useIntraday = $derived(
		intradayData != null && intradayData.history.length > 1 && intradayData.maxDrawdownPct > 0.001
	);

	const chartPoints = $derived(
		useIntraday
			? intradayData!.history.map((d, i) => ({ i, val: d.drawdownPct }))
			: drawdownData.map((d, i) => ({ i, val: d.drawdownPct }))
	);

	const hasData = $derived(chartPoints.some(p => p.val < -0.01));

	const maxDrawdownPct = $derived(
		useIntraday
			? -intradayData!.maxDrawdownPct
			: Math.min(0, ...drawdownData.map(d => d.drawdownPct))
	);

	// Risk level derived from max drawdown
	const riskLevel = $derived(
		maxDrawdownPct >= 15 ? { label: 'Severe', color: 'text-red-400', bg: 'bg-red-500/15' } :
		maxDrawdownPct >= 8  ? { label: 'High',   color: 'text-orange-400', bg: 'bg-orange-500/15' } :
		maxDrawdownPct >= 3  ? { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/15' } :
		                       { label: 'Low',    color: 'text-green-400', bg: 'bg-green-500/15' }
	);

	const W = 400;
	const H = 110;
	const PAD = { top: 10, right: 8, bottom: 18, left: 36 };

	const minVal = $derived(Math.min(0, ...chartPoints.map(p => p.val)));

	function xPos(i: number): number {
		if (chartPoints.length <= 1) return PAD.left;
		return PAD.left + (i / (chartPoints.length - 1)) * (W - PAD.left - PAD.right);
	}
	function yPos(val: number): number {
		if (minVal >= 0) return PAD.top;
		return PAD.top + ((0 - val) / (0 - minVal)) * (H - PAD.top - PAD.bottom);
	}

	const pathD = $derived.by(() => {
		if (chartPoints.length === 0) return '';
		return 'M ' + chartPoints.map(p => `${xPos(p.i).toFixed(1)},${yPos(p.val).toFixed(1)}`).join(' L ');
	});

	const areaD = $derived.by(() => {
		if (chartPoints.length === 0) return '';
		const zeroY = yPos(0);
		const pts = chartPoints.map(p => `${xPos(p.i).toFixed(1)},${yPos(p.val).toFixed(1)}`);
		return `M ${PAD.left},${zeroY} L ${pts.join(' L ')} L ${xPos(chartPoints.length - 1).toFixed(1)},${zeroY} Z`;
	});

	// Worst point — for the nadir marker
	const worstPoint = $derived.by(() => {
		if (chartPoints.length === 0) return null;
		let worst = chartPoints[0];
		for (const p of chartPoints) { if (p.val < worst.val) worst = p; }
		return worst.val < -0.01 ? worst : null;
	});

	const yGridLines = $derived.by(() => {
		const lines = [0];
		let v = -10;
		while (v > minVal - 5) { lines.push(v); v -= 10; }
		return lines;
	});

	const xLabels = $derived.by(() => {
		if (useIntraday || drawdownData.length === 0) return [];
		const labels: { x: number; text: string }[] = [];
		let lastMonth = '';
		drawdownData.forEach((d, i) => {
			const month = d.date.slice(0, 7);
			if (month !== lastMonth) {
				lastMonth = month;
				labels.push({ x: xPos(i), text: d.date.slice(5, 7) + '/' + d.date.slice(2, 4) });
			}
		});
		return labels;
	});

	const gradientId = $derived(useIntraday ? 'dd-grad-intra' : 'dd-grad-daily');
</script>

<div class="w-full">
	{#if !hasData}
		<div class="flex flex-col items-center justify-center py-6 text-center">
			<svg class="w-10 h-10 text-gray-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
			</svg>
			<p class="text-xs text-gray-500">ไม่มีข้อมูล Drawdown</p>
		</div>
	{:else}
		<!-- Stats row -->
		<div class="flex items-start justify-between mb-3">
			<div class="flex items-center gap-4">
				<!-- Primary metric -->
				<div>
					<div class="flex items-center gap-1.5 mb-0.5">
						<span class="text-[9px] text-gray-500 uppercase tracking-wide">
							{useIntraday ? 'Max Drawdown (Intraday)' : 'Max Drawdown (Daily)'}
						</span>
						<span class="text-[9px] px-1.5 py-px rounded-full {riskLevel.bg} {riskLevel.color} font-medium">
							{riskLevel.label}
						</span>
					</div>
					<div class="text-base font-bold text-red-400 tabular-nums leading-none">
						-{maxDrawdownPct.toFixed(2)}%
					</div>
				</div>
				<!-- Absolute -->
				{#if intradayData && intradayData.absoluteDrawdown > 0.01}
					<div class="border-l border-dark-border pl-4">
						<div class="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Absolute</div>
						<div class="text-sm font-semibold text-red-400/80 tabular-nums leading-none">
							-{formatCurrency(intradayData.absoluteDrawdown)}
						</div>
					</div>
				{/if}
			</div>
			<!-- Mode badge -->
			{#if useIntraday}
				<div class="flex items-center gap-1 text-[9px] text-gray-500">
					<span class="w-1 h-1 rounded-full bg-gray-600 inline-block"></span>
					5-min · intraday
				</div>
			{/if}
		</div>

		<!-- Chart -->
		<svg viewBox="0 0 {W} {H}" class="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="กราฟ Drawdown">
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%"   stop-color="#ef4444" stop-opacity="0.28"/>
					<stop offset="100%" stop-color="#ef4444" stop-opacity="0.02"/>
				</linearGradient>
			</defs>

			<!-- Grid lines -->
			{#each yGridLines as v}
				<line
					x1={PAD.left} y1={yPos(v)}
					x2={W - PAD.right} y2={yPos(v)}
					stroke="#1f1f1f" stroke-width="0.5"
				/>
				<text
					x={PAD.left - 4} y={yPos(v)}
					text-anchor="end" dominant-baseline="middle"
					class="fill-gray-600" style="font-size:7px"
				>{v}%</text>
			{/each}

			<!-- Area fill with gradient -->
			<path d={areaD} fill="url(#{gradientId})" />

			<!-- Stroke line -->
			<path d={pathD} fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linejoin="round" />

			<!-- Zero baseline -->
			<line
				x1={PAD.left} y1={yPos(0)}
				x2={W - PAD.right} y2={yPos(0)}
				stroke="#374151" stroke-width="0.5" stroke-dasharray="3,3"
			/>

			<!-- Worst point marker -->
			{#if worstPoint}
				{@const wx = xPos(worstPoint.i)}
				{@const wy = yPos(worstPoint.val)}
				<!-- Vertical drop line -->
				<line
					x1={wx} y1={yPos(0)}
					x2={wx} y2={wy}
					stroke="#ef4444" stroke-width="0.5" stroke-dasharray="2,2" stroke-opacity="0.4"
				/>
				<!-- Dot -->
				<circle cx={wx} cy={wy} r="3" fill="#ef4444" />
				<circle cx={wx} cy={wy} r="5" fill="#ef4444" fill-opacity="0.2" />
			{/if}

			<!-- X-axis month labels -->
			{#each xLabels as lb}
				<text x={lb.x} y={H - 3} text-anchor="middle" class="fill-gray-600" style="font-size:7px">{lb.text}</text>
			{/each}
		</svg>
	{/if}
</div>
