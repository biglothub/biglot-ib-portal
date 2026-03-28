<script lang="ts">
	let {
		label,
		value,
		subValue = '',
		color = 'text-white',
		trend,
		tradeCount,
		donutPercent,
		barData,
		gaugeValue,
		gaugeMax = 3
	}: {
		label: string;
		value: string;
		subValue?: string;
		color?: string;
		trend?: { value: string; positive: boolean };
		tradeCount?: { wins: number; losses: number };
		donutPercent?: number;
		barData?: { left: { value: string; color: string }; right: { value: string; color: string } };
		gaugeValue?: number;
		gaugeMax?: number;
	} = $props();

	// Arc gauge color based on profit factor thresholds
	const gaugeColor = $derived(
		gaugeValue == null ? '#262626' :
		gaugeValue >= 1.5 ? '#22c55e' :
		gaugeValue >= 1.0 ? '#f59e0b' :
		'#ef4444'
	);
	// Arc length: semicircle with r=40 → π*40 ≈ 125.66
	const gaugeArcLen = 125.66;
	const gaugeFill = $derived(
		gaugeValue != null ? Math.min((gaugeValue / gaugeMax), 1) * gaugeArcLen : 0
	);

	// Donut color
	const donutColor = $derived(
		(donutPercent || 0) >= 60 ? '#22c55e' :
		(donutPercent || 0) >= 40 ? '#f59e0b' :
		'#ef4444'
	);
</script>

<div class="card">
	<div class="flex items-start justify-between gap-3">
		<!-- Left: label + value -->
		<div class="flex-1 min-w-0">
			<p class="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
			<div class="flex items-center gap-2 mt-1">
				<p class="text-xl font-bold {color} tabular-nums">{value}</p>
				{#if trend}
					<span class="text-xs font-medium {trend.positive ? 'text-green-400' : 'text-red-400'}">
						{trend.positive ? '▲' : '▼'} {trend.value}
					</span>
				{/if}
			</div>
			{#if subValue}
				<p class="text-xs text-gray-400 mt-0.5">{subValue}</p>
			{/if}
			{#if tradeCount && donutPercent == null && gaugeValue == null}
				<p class="text-[11px] mt-0.5">
					<span class="text-green-400 font-medium">{tradeCount.wins}W</span>
					<span class="text-gray-600 mx-0.5">/</span>
					<span class="text-red-400 font-medium">{tradeCount.losses}L</span>
				</p>
			{/if}
		</div>

		<!-- Right: Donut chart -->
		{#if donutPercent != null}
			<div class="flex flex-col items-center gap-1 flex-shrink-0">
				<svg class="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
					<circle cx="18" cy="18" r="14" fill="none" stroke="#262626" stroke-width="3"></circle>
					<circle cx="18" cy="18" r="14" fill="none"
						stroke={donutColor}
						stroke-width="3"
						stroke-dasharray="{(donutPercent || 0) * 0.88} {88 - (donutPercent || 0) * 0.88}"
						stroke-linecap="round"></circle>
					<!-- Percent label inside (rotated back) -->
					<text x="18" y="20" text-anchor="middle" class="rotate-90"
						fill="white" font-size="7" font-weight="600"
						transform="rotate(90, 18, 18)">{Math.round(donutPercent)}%</text>
				</svg>
				{#if tradeCount}
					<div class="flex gap-1.5 text-[10px]">
						<span class="text-green-400 font-medium">{tradeCount.wins}W</span>
						<span class="text-gray-600">/</span>
						<span class="text-red-400 font-medium">{tradeCount.losses}L</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Right: Arc Gauge (for Profit Factor) -->
		{#if gaugeValue != null}
			<div class="flex flex-col items-center flex-shrink-0">
				<svg viewBox="0 0 100 60" class="w-16 h-10">
					<!-- Background arc -->
					<path d="M 10 50 A 40 40 0 0 1 90 50"
						fill="none" stroke="#262626" stroke-width="8" stroke-linecap="round"/>
					<!-- Value arc -->
					<path d="M 10 50 A 40 40 0 0 1 90 50"
						fill="none" stroke={gaugeColor} stroke-width="8" stroke-linecap="round"
						stroke-dasharray="{gaugeFill} {gaugeArcLen}"/>
					<!-- Value text -->
					<text x="50" y="48" text-anchor="middle"
						fill={gaugeColor} font-size="13" font-weight="700">
						{gaugeValue.toFixed(2)}
					</text>
				</svg>
			</div>
		{/if}
	</div>

	{#if barData}
		{@const leftNum = parseFloat(barData.left.value.replace(/[^0-9.-]/g, '')) || 0}
		{@const rightNum = Math.abs(parseFloat(barData.right.value.replace(/[^0-9.-]/g, '')) || 0)}
		{@const total = leftNum + rightNum}
		{@const leftPct = total > 0 ? (leftNum / total) * 100 : 50}
		<div class="flex items-center gap-1.5 mt-2">
			<span class="text-[10px] font-mono {barData.left.color}">{barData.left.value}</span>
			<div class="flex-1 h-1.5 rounded-full overflow-hidden bg-dark-border flex">
				<div class="bg-green-500/70 h-full rounded-l-full" style="width: {leftPct}%"></div>
				<div class="bg-red-500/70 h-full rounded-r-full" style="width: {100 - leftPct}%"></div>
			</div>
			<span class="text-[10px] font-mono {barData.right.color}">{barData.right.value}</span>
		</div>
	{/if}
</div>
