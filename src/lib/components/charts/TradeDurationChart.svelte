<script lang="ts">
	import type { Trade } from '$lib/types';
	import { formatCurrency } from '$lib/utils';

	let { trades = [] }: { trades?: Trade[] } = $props();

	const W = 400;
	const H = 140;
	const PAD = { top: 10, right: 10, bottom: 28, left: 40 };

	function formatDuration(min: number): string {
		if (min < 60) return `${Math.round(min)}m`;
		const h = Math.floor(min / 60);
		const m = Math.round(min % 60);
		return m > 0 ? `${h}h${m}m` : `${h}h`;
	}

	const points = $derived(trades
		.filter(t => t.open_time && t.close_time && t.profit != null)
		.map(t => {
			const durMin = (new Date(t.close_time).getTime() - new Date(t.open_time).getTime()) / 60000;
			return { durMin, pnl: t.profit, symbol: t.symbol, win: t.profit > 0 };
		})
		.filter(p => p.durMin > 0)
	);

	const hasData = $derived(points.length > 0);

	const bounds = $derived.by(() => {
		if (!hasData) return { maxDur: 60, minPnl: -1, maxPnl: 1 };
		let maxD = -Infinity, minP = 0, maxP = 0;
		for (const p of points) {
			if (p.durMin > maxD) maxD = p.durMin;
			if (p.pnl < minP) minP = p.pnl;
			if (p.pnl > maxP) maxP = p.pnl;
		}
		return {
			maxDur: maxD * 1.05,
			minPnl: minP * 1.1 || -1,
			maxPnl: maxP * 1.1 || 1,
		};
	});

	function xp(dur: number) {
		return PAD.left + (dur / bounds.maxDur) * (W - PAD.left - PAD.right);
	}
	function yp(pnl: number) {
		const range = bounds.maxPnl - bounds.minPnl || 1;
		return PAD.top + ((bounds.maxPnl - pnl) / range) * (H - PAD.top - PAD.bottom);
	}

	const yLabels = $derived.by(() => {
		const step = (bounds.maxPnl - bounds.minPnl) / 4 || 1;
		const labels = [];
		for (let v = bounds.minPnl; v <= bounds.maxPnl + 0.001; v += step) {
			labels.push(Math.round(v * 100) / 100);
		}
		return labels;
	});

	// X labels: pick 4-5 evenly spaced duration values
	const xLabels = $derived.by(() => {
		const step = bounds.maxDur / 4;
		return [0, 1, 2, 3, 4].map(i => i * step);
	});
</script>

<div class="w-full">
	{#if !hasData}
		<div class="flex flex-col items-center justify-center py-8">
			<p class="text-xs text-gray-500">ไม่มีข้อมูล</p>
		</div>
	{:else}
		<svg viewBox="0 0 {W} {H}" class="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="กราฟผลกำไรตามระยะเวลาถือ">
			{#each yLabels as v}
				<line x1={PAD.left} y1={yp(v)} x2={W - PAD.right} y2={yp(v)}
					stroke="#1f2937" stroke-width="0.5" />
				<text x={PAD.left - 3} y={yp(v)} text-anchor="end" dominant-baseline="middle"
					class="fill-gray-600" style="font-size:7px">${v}</text>
			{/each}

			<line x1={PAD.left} y1={yp(0)} x2={W - PAD.right} y2={yp(0)}
				stroke="#374151" stroke-width="0.8" stroke-dasharray="3,3" />

			{#each xLabels as dur}
				<text x={xp(dur)} y={H - 6} text-anchor="middle" class="fill-gray-600" style="font-size:7px">
					{formatDuration(dur)}
				</text>
			{/each}

			{#each points as p}
				<circle cx={xp(p.durMin)} cy={yp(p.pnl)} r="4"
					fill={p.win ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)'}
					stroke={p.win ? '#16a34a' : '#dc2626'}
					stroke-width="0.5">
					<title>{p.symbol} {formatDuration(p.durMin)} — {formatCurrency(p.pnl)}</title>
				</circle>
			{/each}
		</svg>
	{/if}
</div>
