<script lang="ts">
	let {
		winRate = 0,
		profitFactor = 0,
		avgWin = 0,
		avgLoss = 0
	}: {
		winRate?: number;
		profitFactor?: number;
		avgWin?: number;
		avgLoss?: number;
	} = $props();

	const CX = 100;
	const CY = 85;
	const R = 65;

	// Angles: top (-90°), bottom-right (30°), bottom-left (150°)
	const axes = [
		{ angle: -90, label: 'Win %' },
		{ angle: 30, label: 'Profit Factor' },
		{ angle: 150, label: 'Avg Win/Loss' }
	];

	function toRad(deg: number) { return (deg * Math.PI) / 180; }
	function px(angle: number, pct: number) { return CX + R * (pct / 100) * Math.cos(toRad(angle)); }
	function py(angle: number, pct: number) { return CY + R * (pct / 100) * Math.sin(toRad(angle)); }

	// Normalize to 0-100
	const nWinRate = $derived(Math.min(Math.max(winRate || 0, 0), 100));
	const nPF = $derived(Math.min(((profitFactor || 0) / 3) * 100, 100));
	const wlRatio = $derived((avgLoss || 0) !== 0 ? Math.abs((avgWin || 0) / (avgLoss || 1)) : 0);
	const nRatio = $derived(Math.min((wlRatio / 3) * 100, 100));

	const score = $derived(Math.round(nWinRate * 0.35 + nPF * 0.35 + nRatio * 0.30));

	// Data polygon points
	const dataPoints = $derived(
		`${px(axes[0].angle, nWinRate)},${py(axes[0].angle, nWinRate)} ` +
		`${px(axes[1].angle, nPF)},${py(axes[1].angle, nPF)} ` +
		`${px(axes[2].angle, nRatio)},${py(axes[2].angle, nRatio)}`
	);

	// Grid polygon helper
	function gridPoints(pct: number) {
		return axes.map(a => `${px(a.angle, pct)},${py(a.angle, pct)}`).join(' ');
	}

	// Score color
	const scoreColor = $derived(
		score >= 70 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
	);
</script>

<div class="w-full">
	<div class="flex items-center gap-2 mb-2">
		<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">Trading Score</p>
	</div>

	<svg viewBox="0 0 200 170" class="w-full max-w-[280px] mx-auto">
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
		<circle cx={px(axes[0].angle, nWinRate)} cy={py(axes[0].angle, nWinRate)} r="3.5" fill="#C9A84C" />
		<circle cx={px(axes[1].angle, nPF)} cy={py(axes[1].angle, nPF)} r="3.5" fill="#C9A84C" />
		<circle cx={px(axes[2].angle, nRatio)} cy={py(axes[2].angle, nRatio)} r="3.5" fill="#C9A84C" />

		<!-- Axis labels -->
		<text x={px(axes[0].angle, 115)} y={py(axes[0].angle, 115)} text-anchor="middle" class="fill-gray-400 text-[9px]">
			Win %
		</text>
		<text x={px(axes[1].angle, 120)} y={py(axes[1].angle, 120)} text-anchor="start" class="fill-gray-400 text-[9px]">
			Profit Factor
		</text>
		<text x={px(axes[2].angle, 120)} y={py(axes[2].angle, 120)} text-anchor="end" class="fill-gray-400 text-[9px]">
			Avg Win/Loss
		</text>
	</svg>

	<div class="text-center -mt-1">
		<span class="text-sm text-gray-400">Your Score:</span>
		<span class="text-2xl font-bold ml-1.5 {scoreColor}">{score}</span>
	</div>
</div>
