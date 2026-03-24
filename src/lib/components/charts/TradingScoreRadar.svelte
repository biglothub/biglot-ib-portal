<script lang="ts">
	let {
		winRate = 0,
		profitFactor = 0,
		avgWin = 0,
		avgLoss = 0,
		recoveryFactor = 0,
		maxDrawdownPct = 0,
		consistency = 0
	}: {
		winRate?: number;
		profitFactor?: number;
		avgWin?: number;
		avgLoss?: number;
		recoveryFactor?: number;
		maxDrawdownPct?: number;
		consistency?: number;
	} = $props();

	const CX = 130;
	const CY = 110;
	const R = 70;

	// 6 axes evenly spaced (60° apart), starting from top
	const axes = [
		{ angle: -90, label: 'Win %', shortLabel: 'Win' },
		{ angle: -30, label: 'Profit Factor', shortLabel: 'PF' },
		{ angle: 30, label: 'Avg W/L', shortLabel: 'W/L' },
		{ angle: 90, label: 'Recovery', shortLabel: 'Rec' },
		{ angle: 150, label: 'Drawdown', shortLabel: 'DD' },
		{ angle: 210, label: 'Consistency', shortLabel: 'Con' }
	];

	function toRad(deg: number) { return (deg * Math.PI) / 180; }
	function px(angle: number, pct: number) { return CX + R * (pct / 100) * Math.cos(toRad(angle)); }
	function py(angle: number, pct: number) { return CY + R * (pct / 100) * Math.sin(toRad(angle)); }

	// Normalize all metrics to 0-100 scale
	const nWinRate = $derived(Math.min(Math.max(winRate || 0, 0), 100));
	const nPF = $derived(Math.min(((profitFactor || 0) / 3) * 100, 100));
	const wlRatio = $derived((avgLoss || 0) !== 0 ? Math.abs((avgWin || 0) / (avgLoss || 1)) : 0);
	const nRatio = $derived(Math.min((wlRatio / 3) * 100, 100));

	// New metrics normalized to 0-100
	// Recovery Factor: Net P&L / Max Drawdown (good = > 3, normalize /5 * 100)
	const nRecovery = $derived(Math.min(((recoveryFactor || 0) / 5) * 100, 100));
	// Max Drawdown: inverted — low drawdown = high score (0% DD = 100 score, 50%+ DD = 0)
	const nDrawdown = $derived(Math.max(0, Math.min(100, 100 - (maxDrawdownPct || 0) * 2)));
	// Consistency: 0-1 scale → 0-100 (1 = perfectly consistent)
	const nConsistency = $derived(Math.min(Math.max((consistency || 0) * 100, 0), 100));

	const values = $derived([nWinRate, nPF, nRatio, nRecovery, nDrawdown, nConsistency]);

	// Overall score (weighted average)
	const score = $derived(Math.round(
		nWinRate * 0.20 +
		nPF * 0.20 +
		nRatio * 0.15 +
		nRecovery * 0.15 +
		nDrawdown * 0.15 +
		nConsistency * 0.15
	));

	// Data polygon points
	const dataPoints = $derived(
		axes.map((a, i) => `${px(a.angle, values[i])},${py(a.angle, values[i])}`).join(' ')
	);

	// Grid polygon helper
	function gridPoints(pct: number) {
		return axes.map(a => `${px(a.angle, pct)},${py(a.angle, pct)}`).join(' ');
	}

	// Score color
	const scoreColor = $derived(
		score >= 70 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
	);

	// Label positions (slightly outside the chart)
	function labelX(angle: number) { return CX + (R + 18) * Math.cos(toRad(angle)); }
	function labelY(angle: number) { return CY + (R + 18) * Math.sin(toRad(angle)); }
	function labelAnchor(angle: number) {
		const cos = Math.cos(toRad(angle));
		if (cos > 0.3) return 'start';
		if (cos < -0.3) return 'end';
		return 'middle';
	}
</script>

<div class="w-full">
	<div class="flex items-center gap-2 mb-2">
		<p class="text-[10px] uppercase tracking-[0.24em] text-gray-400">คะแนนการเทรด</p>
	</div>

	<svg viewBox="0 0 260 230" class="w-full max-w-[300px] mx-auto">
		<!-- Grid rings -->
		{#each [25, 50, 75, 100] as pct}
			<polygon
				points={gridPoints(pct)}
				fill="none"
				stroke="#262626"
				stroke-width={pct === 100 ? '1' : '0.5'}
				opacity={pct === 100 ? 0.8 : 0.4}
			/>
		{/each}

		<!-- Axis lines -->
		{#each axes as axis}
			<line
				x1={CX} y1={CY}
				x2={px(axis.angle, 100)} y2={py(axis.angle, 100)}
				stroke="#262626" stroke-width="0.5" opacity="0.6"
			/>
		{/each}

		<!-- Data polygon -->
		<polygon
			points={dataPoints}
			fill="rgba(201, 168, 76, 0.15)"
			stroke="#C9A84C"
			stroke-width="2"
			stroke-linejoin="round"
		/>

		<!-- Data points -->
		{#each axes as axis, i}
			<circle
				cx={px(axis.angle, values[i])}
				cy={py(axis.angle, values[i])}
				r="3"
				fill="#C9A84C"
			/>
		{/each}

		<!-- Axis labels -->
		{#each axes as axis}
			<text
				x={labelX(axis.angle)}
				y={labelY(axis.angle)}
				text-anchor={labelAnchor(axis.angle)}
				dominant-baseline="middle"
				class="fill-gray-400"
				style="font-size: 9px"
			>
				{axis.label}
			</text>
		{/each}
	</svg>

	<div class="text-center -mt-2">
		<span class="text-sm text-gray-400">คะแนนของคุณ:</span>
		<span class="text-2xl font-bold ml-1.5 {scoreColor}">{score}</span>
	</div>
</div>
