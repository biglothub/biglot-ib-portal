<script lang="ts">
	let {
		label,
		value,
		subValue = '',
		color = 'text-white',
		trend,
		tradeCount,
		donutPercent,
		barData
	}: {
		label: string;
		value: string;
		subValue?: string;
		color?: string;
		trend?: { value: string; positive: boolean };
		tradeCount?: { wins: number; losses: number };
		donutPercent?: number;
		barData?: { left: { value: string; color: string }; right: { value: string; color: string } };
	} = $props();
</script>

<div class="card">
	<div class="flex items-start justify-between">
		<div class="flex-1 min-w-0">
			<p class="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
			<div class="flex items-center gap-2 mt-1">
				<p class="text-xl font-bold {color}">{value}</p>
				{#if trend}
					<span class="text-xs font-medium {trend.positive ? 'text-green-400' : 'text-red-400'}">
						{trend.positive ? '▲' : '▼'} {trend.value}
					</span>
				{/if}
			</div>
			{#if subValue}
				<p class="text-xs text-gray-500 mt-0.5">{subValue}</p>
			{/if}
			{#if tradeCount}
				<p class="text-[11px] text-gray-500 mt-0.5">
					<span class="text-green-400">{tradeCount.wins}W</span>
					<span class="text-gray-600 mx-0.5">/</span>
					<span class="text-red-400">{tradeCount.losses}L</span>
				</p>
			{/if}
		</div>
		{#if donutPercent != null}
			<svg class="w-10 h-10 -rotate-90 flex-shrink-0" viewBox="0 0 36 36">
				<circle cx="18" cy="18" r="14" fill="none" stroke="#262626" stroke-width="3"></circle>
				<circle cx="18" cy="18" r="14" fill="none"
					stroke={(donutPercent || 0) >= 50 ? '#22c55e' : '#f59e0b'}
					stroke-width="3"
					stroke-dasharray="{(donutPercent || 0) * 0.88} {88 - (donutPercent || 0) * 0.88}"
					stroke-linecap="round"></circle>
			</svg>
		{/if}
	</div>
	{#if barData}
		<div class="flex items-center gap-1.5 mt-2">
			<span class="text-[10px] font-mono {barData.left.color}">{barData.left.value}</span>
			<div class="flex-1 h-1.5 rounded-full overflow-hidden bg-dark-border flex">
				<div class="bg-green-500/70 h-full rounded-l-full" style="width: 50%"></div>
				<div class="bg-red-500/70 h-full rounded-r-full" style="width: 50%"></div>
			</div>
			<span class="text-[10px] font-mono {barData.right.color}">{barData.right.value}</span>
		</div>
	{/if}
</div>
