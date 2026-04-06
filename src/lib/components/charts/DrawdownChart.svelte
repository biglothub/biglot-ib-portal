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

	const W = 400;
	const H = 120;
	const PAD = { top: 8, right: 8, bottom: 20, left: 36 };

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
</script>

<div class="w-full">
	{#if !hasData}
		<div class="flex flex-col items-center justify-center py-8 text-center">
			<svg class="w-12 h-12 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
			</svg>
			<p class="text-xs text-gray-500">ไม่มีข้อมูล Drawdown</p>
		</div>
	{:else}
		<!-- Stats row -->
		<div class="flex items-center justify-between mb-2">
			<div class="flex items-center gap-4">
				<div>
					<div class="text-[9px] text-gray-500 uppercase tracking-wide">
						{useIntraday ? 'Max Drawdown (Intraday)' : 'Max Drawdown (Daily)'}
					</div>
					<div class="text-sm font-bold text-red-400">{maxDrawdownPct.toFixed(2)}%</div>
				</div>
				{#if intradayData && intradayData.absoluteDrawdown > 0.01}
					<div>
						<div class="text-[9px] text-gray-500 uppercase tracking-wide">Absolute</div>
						<div class="text-sm font-bold text-red-400">-{formatCurrency(intradayData.absoluteDrawdown)}</div>
					</div>
				{/if}
			</div>
			{#if useIntraday}
				<div class="text-[9px] text-gray-600">5-min · myfxbook-style</div>
			{/if}
		</div>

		<svg viewBox="0 0 {W} {H}" class="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="กราฟ Drawdown">
			{#each yGridLines as v}
				<line x1={PAD.left} y1={yPos(v)} x2={W - PAD.right} y2={yPos(v)} stroke="#262626" stroke-width="0.5" />
				<text x={PAD.left - 3} y={yPos(v)} text-anchor="end" dominant-baseline="middle"
					class="fill-gray-600" style="font-size:7px">{v}%</text>
			{/each}
			<path d={areaD} fill="rgba(239,68,68,0.15)" />
			<path d={pathD} fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linejoin="round" />
			<line x1={PAD.left} y1={yPos(0)} x2={W - PAD.right} y2={yPos(0)}
				stroke="#374151" stroke-width="0.5" stroke-dasharray="3,3" />
			{#each xLabels as lb}
				<text x={lb.x} y={H - 4} text-anchor="middle" class="fill-gray-600" style="font-size:7px">{lb.text}</text>
			{/each}
		</svg>
	{/if}
</div>
