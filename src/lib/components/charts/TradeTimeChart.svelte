<script lang="ts">
	import type { Trade } from '$lib/types';
	import { formatCurrency } from '$lib/utils';

	let { trades = [] }: { trades?: Trade[] } = $props();

	const W = 400;
	const H = 140;
	const PAD = { top: 10, right: 10, bottom: 28, left: 40 };

	const points = $derived(trades
		.filter(t => t.close_time && t.profit != null)
		.map(t => {
			const d = new Date(t.close_time);
			const hour = d.getHours() + d.getMinutes() / 60;
			return { hour, pnl: t.profit, symbol: t.symbol, time: d.toTimeString().slice(0, 5), win: t.profit > 0 };
		})
	);

	const hasData = $derived(points.length > 0);

	const bounds = $derived.by(() => {
		if (!hasData) return { minHour: 0, maxHour: 24, minPnl: -1, maxPnl: 1 };
		let minH = Infinity, maxH = -Infinity, minP = 0, maxP = 0;
		for (const p of points) {
			if (p.hour < minH) minH = p.hour;
			if (p.hour > maxH) maxH = p.hour;
			if (p.pnl < minP) minP = p.pnl;
			if (p.pnl > maxP) maxP = p.pnl;
		}
		return {
			minHour: Math.max(0, minH - 0.5),
			maxHour: Math.min(24, maxH + 0.5),
			minPnl: minP * 1.1 || -1,
			maxPnl: maxP * 1.1 || 1,
		};
	});

	function xp(hour: number) {
		return PAD.left + ((hour - bounds.minHour) / (bounds.maxHour - bounds.minHour)) * (W - PAD.left - PAD.right);
	}
	function yp(pnl: number) {
		const range = bounds.maxPnl - bounds.minPnl || 1;
		return PAD.top + ((bounds.maxPnl - pnl) / range) * (H - PAD.top - PAD.bottom);
	}

	// Y axis labels
	const yLabels = $derived.by(() => {
		const step = (bounds.maxPnl - bounds.minPnl) / 4 || 1;
		const labels = [];
		for (let v = bounds.minPnl; v <= bounds.maxPnl + 0.001; v += step) {
			labels.push(Math.round(v * 100) / 100);
		}
		return labels;
	});

	// X axis hour labels
	const xLabels = $derived.by(() => {
		const labels = [];
		for (let h = Math.ceil(bounds.minHour); h <= Math.floor(bounds.maxHour); h++) {
			labels.push(h);
		}
		return labels;
	});
</script>

<div class="w-full">
	{#if !hasData}
		<div class="flex flex-col items-center justify-center py-8">
			<p class="text-xs text-gray-500">ไม่มีข้อมูล</p>
		</div>
	{:else}
		<svg viewBox="0 0 {W} {H}" class="w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="กราฟผลกำไรตามเวลาเทรด">
			<!-- Y grid + labels -->
			{#each yLabels as v}
				<line x1={PAD.left} y1={yp(v)} x2={W - PAD.right} y2={yp(v)}
					stroke="#1f2937" stroke-width="0.5" />
				<text x={PAD.left - 3} y={yp(v)} text-anchor="end" dominant-baseline="middle"
					class="fill-gray-600" style="font-size:7px">${v}</text>
			{/each}

			<!-- Zero line -->
			<line x1={PAD.left} y1={yp(0)} x2={W - PAD.right} y2={yp(0)}
				stroke="#374151" stroke-width="0.8" stroke-dasharray="3,3" />

			<!-- X labels -->
			{#each xLabels as h}
				<text x={xp(h)} y={H - 6} text-anchor="middle" class="fill-gray-600" style="font-size:7px">
					{String(h).padStart(2,'0')}:00
				</text>
			{/each}

			<!-- Data points -->
			{#each points as p}
				<circle cx={xp(p.hour)} cy={yp(p.pnl)} r="4"
					fill={p.win ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)'}
					stroke={p.win ? '#16a34a' : '#dc2626'}
					stroke-width="0.5">
					<title>{p.symbol} {p.time} — {formatCurrency(p.pnl)}</title>
				</circle>
			{/each}
		</svg>
	{/if}
</div>
