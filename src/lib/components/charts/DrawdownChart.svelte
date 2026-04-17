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

	const useIntraday = $derived(
		intradayData != null && intradayData.history.length > 1 && intradayData.maxDrawdownPct > 0.001
	);

	type Point = { i: number; val: number; label: string };

	const points = $derived.by<Point[]>(() => {
		if (useIntraday) {
			return intradayData!.history.map((d, i) => ({
				i,
				val: d.drawdownPct,
				label: new Date(d.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
			}));
		}
		return drawdownData.map((d, i) => ({ i, val: d.drawdownPct, label: d.date }));
	});

	const hasData = $derived(points.some(p => p.val < -0.01));

	// Current DD = last point's DD magnitude
	const currentDdPct = $derived(points.length > 0 ? Math.abs(points[points.length - 1].val) : 0);

	// Max DD magnitude
	const maxDdPct = $derived(
		useIntraday
			? intradayData!.maxDrawdownPct
			: Math.abs(Math.min(0, ...drawdownData.map(d => d.drawdownPct)))
	);

	type Episode = { startIdx: number; troughIdx: number; endIdx: number | null; depth: number; duration: number };

	// Detect drawdown episodes: segments where equity is below prior peak.
	const episodes = $derived.by<Episode[]>(() => {
		if (points.length < 2) return [];
		const eps: Episode[] = [];
		let inDd = false;
		let startIdx = 0;
		let troughIdx = 0;
		let trough = 0;
		for (let i = 0; i < points.length; i++) {
			const v = points[i].val;
			if (!inDd && v < -0.01) {
				inDd = true;
				startIdx = i;
				troughIdx = i;
				trough = v;
			} else if (inDd) {
				if (v < trough) { trough = v; troughIdx = i; }
				if (v >= -0.005) {
					eps.push({ startIdx, troughIdx, endIdx: i, depth: Math.abs(trough), duration: i - startIdx });
					inDd = false;
				}
			}
		}
		if (inDd) {
			eps.push({ startIdx, troughIdx, endIdx: null, depth: Math.abs(trough), duration: points.length - 1 - startIdx });
		}
		return eps;
	});

	const isUnderwater = $derived(currentDdPct > 0.01);

	const riskLevel = $derived(
		maxDdPct >= 15 ? { label: 'Severe', color: 'text-red-400',    bg: 'bg-red-500/15' } :
		maxDdPct >= 8  ? { label: 'High',   color: 'text-orange-400', bg: 'bg-orange-500/15' } :
		maxDdPct >= 3  ? { label: 'Medium', color: 'text-amber-400',  bg: 'bg-amber-500/15' } :
		                 { label: 'Low',    color: 'text-green-400',  bg: 'bg-green-500/15' }
	);

	// Tone the max DD number by risk level so "Low" doesn't scream red
	const maxDdColor = $derived(
		maxDdPct >= 8 ? 'text-red-400'
		: maxDdPct >= 3 ? 'text-amber-400'
		: 'text-gray-200'
	);

	const W = 400;
	const H = 260;
	const PAD = { top: 18, right: 12, bottom: 22, left: 42 };
	const plotW = W - PAD.left - PAD.right;
	const plotH = H - PAD.top - PAD.bottom;

	// Y-axis: cap at max(maxDd * 1.3, 3) so small DDs remain visible but severe ones aren't crushed.
	const yMax = $derived(Math.max(maxDdPct * 1.3, 3));

	function xPos(i: number): number {
		if (points.length <= 1) return PAD.left;
		return PAD.left + (i / (points.length - 1)) * plotW;
	}
	function yPos(ddMagnitude: number): number {
		return PAD.top + (ddMagnitude / yMax) * plotH;
	}

	// Threshold bands (as DD magnitudes, positive)
	const bands = $derived.by(() => {
		const thresholds = [
			{ v: 3,  label: 'Medium', color: '#f59e0b' },
			{ v: 8,  label: 'High',   color: '#f97316' },
			{ v: 15, label: 'Severe', color: '#ef4444' }
		];
		return thresholds.filter(t => t.v <= yMax);
	});

	// X-axis labels
	const xLabels = $derived.by(() => {
		if (points.length < 2) return [] as { x: number; text: string }[];
		if (useIntraday) {
			const count = 4;
			const out: { x: number; text: string }[] = [];
			for (let k = 0; k < count; k++) {
				const idx = Math.round((k / (count - 1)) * (points.length - 1));
				out.push({ x: xPos(idx), text: points[idx].label });
			}
			return out;
		}
		const out: { x: number; text: string }[] = [];
		let lastMonth = '';
		drawdownData.forEach((d, i) => {
			const month = d.date.slice(0, 7);
			if (month !== lastMonth) {
				lastMonth = month;
				out.push({ x: xPos(i), text: d.date.slice(5, 7) + '/' + d.date.slice(2, 4) });
			}
		});
		return out;
	});

	// Color an episode by its depth
	function episodeColor(depth: number): string {
		if (depth >= 15) return '#ef4444';
		if (depth >= 8)  return '#f97316';
		if (depth >= 3)  return '#f59e0b';
		return '#ef4444';
	}

	// Worst episode (for the emphasized marker)
	const worstEpIdx = $derived.by(() => {
		if (episodes.length === 0) return -1;
		let best = 0;
		for (let i = 1; i < episodes.length; i++) if (episodes[i].depth > episodes[best].depth) best = i;
		return best;
	});
</script>

<div class="w-full h-full flex flex-col">
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
		<div class="flex items-start justify-between gap-3 mb-3">
			<div class="flex items-center gap-4 min-w-0">
				<!-- Max DD -->
				<div class="min-w-0">
					<div class="flex items-center gap-1.5 mb-0.5">
						<span class="text-[9px] text-gray-500 uppercase tracking-wide">Max Drawdown</span>
						<span class="text-[9px] px-1.5 py-px rounded-full {riskLevel.bg} {riskLevel.color} font-medium">
							{riskLevel.label}
						</span>
					</div>
					<div class="text-base font-bold {maxDdColor} tabular-nums leading-none">
						-{maxDdPct.toFixed(2)}%
					</div>
					{#if intradayData && intradayData.absoluteDrawdown > 0.01}
						<div class="text-[10px] text-gray-500 tabular-nums mt-0.5">
							-{formatCurrency(intradayData.absoluteDrawdown)}
						</div>
					{/if}
				</div>
				<!-- Current DD -->
				<div class="border-l border-dark-border pl-4 min-w-0">
					<div class="text-[9px] text-gray-500 uppercase tracking-wide mb-0.5">Current</div>
					<div class="text-sm font-semibold tabular-nums leading-none {isUnderwater ? 'text-red-400/80' : 'text-green-400'}">
						{isUnderwater ? '-' : ''}{currentDdPct.toFixed(2)}%
					</div>
					<div class="text-[10px] mt-0.5 {isUnderwater ? 'text-amber-400/80' : 'text-green-400/80'}">
						{isUnderwater ? 'Underwater' : 'At peak'}
					</div>
				</div>
			</div>
			<div class="flex flex-col items-end gap-0.5 text-[9px] text-gray-500 shrink-0">
				<span>{episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'}</span>
				<span>{useIntraday ? '5-min · intraday' : 'daily'}</span>
			</div>
		</div>

		<!-- Chart -->
		<svg viewBox="0 0 {W} {H}" class="w-full flex-1 min-h-[200px]" preserveAspectRatio="xMidYMid meet" role="img" aria-label="กราฟ Drawdown">
			<!-- Threshold bands (horizontal dashed lines at thresholds) -->
			{#each bands as b}
				<line
					x1={PAD.left} y1={yPos(b.v)}
					x2={W - PAD.right} y2={yPos(b.v)}
					stroke={b.color} stroke-width="0.8" stroke-dasharray="3,4" stroke-opacity="0.3"
				/>
				<text
					x={PAD.left - 6} y={yPos(b.v)}
					text-anchor="end" dominant-baseline="middle"
					fill={b.color} fill-opacity="0.7" style="font-size:10px"
				>-{b.v}%</text>
			{/each}

			<!-- Zero baseline -->
			<line
				x1={PAD.left} y1={PAD.top}
				x2={W - PAD.right} y2={PAD.top}
				stroke="#4b5563" stroke-width="1"
			/>
			<text
				x={PAD.left - 6} y={PAD.top}
				text-anchor="end" dominant-baseline="middle"
				class="fill-gray-400" style="font-size:10px; font-weight:500"
			>0%</text>

			<!-- Episode lollipops -->
			{#each episodes as ep, idx}
				{@const x1 = xPos(ep.startIdx)}
				{@const x2 = xPos(ep.endIdx ?? points.length - 1)}
				{@const cx = xPos(ep.troughIdx)}
				{@const cy = yPos(ep.depth)}
				{@const color = episodeColor(ep.depth)}
				{@const isWorst = idx === worstEpIdx}
				<!-- Duration bar at 0-line (how long this DD lasted) -->
				<line
					x1={x1} y1={PAD.top}
					x2={x2} y2={PAD.top}
					stroke={color} stroke-width="3" stroke-opacity="0.4" stroke-linecap="round"
				/>
				<!-- Stem down to trough -->
				<line
					x1={cx} y1={PAD.top}
					x2={cx} y2={cy}
					stroke={color} stroke-width={isWorst ? 2.5 : 1.5}
					stroke-opacity={isWorst ? 0.9 : 0.6}
				/>
				<!-- Halo + dot at trough -->
				{#if isWorst}
					<circle cx={cx} cy={cy} r="9" fill={color} fill-opacity="0.15" />
					<circle cx={cx} cy={cy} r="6" fill={color} fill-opacity="0.25" />
				{/if}
				<circle cx={cx} cy={cy} r={isWorst ? 4.5 : 3} fill={color} />
				{#if isWorst}
					<text
						x={cx} y={cy + 16}
						text-anchor="middle" fill={color}
						style="font-size:10px; font-weight:600"
					>-{ep.depth.toFixed(1)}%</text>
				{/if}
			{/each}

			<!-- Current-DD marker (if underwater) -->
			{#if isUnderwater && points.length > 0}
				{@const lx = xPos(points.length - 1)}
				{@const ly = yPos(currentDdPct)}
				<circle cx={lx} cy={ly} r="5" fill="#fbbf24" fill-opacity="0.2" />
				<circle cx={lx} cy={ly} r="3.5" fill="#fbbf24" stroke="#0a0a0a" stroke-width="1" />
			{/if}

			<!-- X-axis labels -->
			{#each xLabels as lb}
				<text x={lb.x} y={H - 6} text-anchor="middle" class="fill-gray-500" style="font-size:10px">{lb.text}</text>
			{/each}
		</svg>
	{/if}
</div>
