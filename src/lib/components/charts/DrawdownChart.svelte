<script lang="ts">
	import { formatPercent } from '$lib/utils';

	let { drawdownData = [] }: {
		drawdownData?: { date: string; drawdownPct: number }[];
	} = $props();

	const hasData = $derived(drawdownData.some(d => d.drawdownPct < -0.01));

	const W = 400;
	const H = 120;
	const PAD = { top: 8, right: 8, bottom: 20, left: 36 };

	const minVal = $derived(Math.min(0, ...drawdownData.map(d => d.drawdownPct)));

	function xPos(i: number): number {
		if (drawdownData.length <= 1) return PAD.left;
		return PAD.left + (i / (drawdownData.length - 1)) * (W - PAD.left - PAD.right);
	}
	function yPos(val: number): number {
		if (minVal >= 0) return PAD.top;
		return PAD.top + ((0 - val) / (0 - minVal)) * (H - PAD.top - PAD.bottom);
	}

	const pathD = $derived.by(() => {
		if (drawdownData.length === 0) return '';
		const pts = drawdownData.map((d, i) => `${xPos(i)},${yPos(d.drawdownPct)}`);
		return `M ${pts.join(' L ')}`;
	});

	const areaD = $derived.by(() => {
		if (drawdownData.length === 0) return '';
		const zeroY = yPos(0);
		const pts = drawdownData.map((d, i) => `${xPos(i)},${yPos(d.drawdownPct)}`);
		return `M ${PAD.left},${zeroY} L ${pts.join(' L ')} L ${xPos(drawdownData.length - 1)},${zeroY} Z`;
	});

	// Y-axis grid lines at 0%, -10%, -20%... down to minVal
	const yGridLines = $derived.by(() => {
		const lines = [0];
		let v = -10;
		while (v > minVal - 5) { lines.push(v); v -= 10; }
		return lines;
	});

	// X-axis: show first date of each month
	const xLabels = $derived.by(() => {
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

	const maxDrawdownPct = $derived(Math.min(0, ...drawdownData.map(d => d.drawdownPct)));
</script>

<div class="w-full">
	{#if !hasData}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center py-8 text-center">
			<svg class="w-12 h-12 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
					d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
			</svg>
			<p class="text-xs text-gray-500">ไม่มีข้อมูล Drawdown</p>
		</div>
	{:else}
		<!-- Max drawdown label -->
		<div class="text-right mb-1">
			<span class="text-[10px] text-gray-500">Max drawdown: </span>
			<span class="text-[10px] font-medium text-red-400">{maxDrawdownPct.toFixed(1)}%</span>
		</div>

		<svg viewBox="0 0 {W} {H}" class="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="กราฟ Drawdown">
			<!-- Y grid lines -->
			{#each yGridLines as v}
				<line
					x1={PAD.left} y1={yPos(v)}
					x2={W - PAD.right} y2={yPos(v)}
					stroke="#262626" stroke-width="0.5"
				/>
				<text x={PAD.left - 3} y={yPos(v)} text-anchor="end" dominant-baseline="middle"
					class="fill-gray-600" style="font-size:7px">{v}%</text>
			{/each}

			<!-- Area fill -->
			<path d={areaD} fill="rgba(239,68,68,0.15)" />

			<!-- Line -->
			<path d={pathD} fill="none" stroke="#ef4444" stroke-width="1.5" stroke-linejoin="round" />

			<!-- Zero line -->
			<line x1={PAD.left} y1={yPos(0)} x2={W - PAD.right} y2={yPos(0)}
				stroke="#374151" stroke-width="0.5" stroke-dasharray="3,3" />

			<!-- X labels -->
			{#each xLabels as lb}
				<text x={lb.x} y={H - 4} text-anchor="middle" class="fill-gray-600" style="font-size:7px">
					{lb.text}
				</text>
			{/each}
		</svg>
	{/if}
</div>
