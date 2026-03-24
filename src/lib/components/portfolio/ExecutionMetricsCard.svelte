<script lang="ts">
	let { metrics }: {
		metrics: {
			plannedRisk: number | null;
			plannedReward: number | null;
			rMultiple: number | null;
			executionEfficiency: number | null;
		};
	} = $props();

	const rColor = $derived(
		metrics.rMultiple == null ? 'text-gray-400' :
		metrics.rMultiple >= 2 ? 'text-green-400' :
		metrics.rMultiple >= 1 ? 'text-green-300' :
		metrics.rMultiple >= 0 ? 'text-amber-400' :
		metrics.rMultiple >= -1 ? 'text-red-300' :
		'text-red-400'
	);

	const effColor = $derived(
		metrics.executionEfficiency == null ? 'text-gray-400' :
		metrics.executionEfficiency >= 80 ? 'text-green-400' :
		metrics.executionEfficiency >= 50 ? 'text-amber-400' :
		'text-red-400'
	);

	function fmt(val: number | null, suffix = ''): string {
		if (val == null) return 'N/A';
		return `${val >= 0 ? '' : ''}${val.toFixed(2)}${suffix}`;
	}
</script>

<div class="card">
	<p class="text-xs text-gray-400 uppercase tracking-wider mb-3">Execution Metrics</p>
	<div class="grid grid-cols-2 gap-3">
		<!-- R-Multiple -->
		<div>
			<p class="text-[10px] text-gray-400 uppercase tracking-wider">R-Multiple</p>
			<p class="text-lg font-bold font-mono {rColor}">
				{metrics.rMultiple != null ? `${metrics.rMultiple >= 0 ? '+' : ''}${metrics.rMultiple.toFixed(2)}R` : 'N/A'}
			</p>
		</div>
		<!-- Execution Efficiency -->
		<div>
			<p class="text-[10px] text-gray-400 uppercase tracking-wider">Efficiency</p>
			<p class="text-lg font-bold font-mono {effColor}">
				{metrics.executionEfficiency != null ? `${metrics.executionEfficiency.toFixed(0)}%` : 'N/A'}
			</p>
		</div>
		<!-- Planned Risk -->
		<div>
			<p class="text-[10px] text-gray-400 uppercase tracking-wider">Planned Risk</p>
			<p class="text-sm font-mono text-gray-300">
				{metrics.plannedRisk != null ? `$${metrics.plannedRisk.toFixed(2)}` : 'No SL'}
			</p>
		</div>
		<!-- Planned Reward -->
		<div>
			<p class="text-[10px] text-gray-400 uppercase tracking-wider">Planned Reward</p>
			<p class="text-sm font-mono text-gray-300">
				{metrics.plannedReward != null ? `$${metrics.plannedReward.toFixed(2)}` : 'No TP'}
			</p>
		</div>
	</div>
	<!-- R-Multiple bar visualization -->
	{#if metrics.rMultiple != null}
		{@const barPct = Math.min(Math.max((metrics.rMultiple + 3) / 6 * 100, 0), 100)}
		<div class="mt-3">
			<div class="flex items-center gap-2 text-[10px] text-gray-400">
				<span>-3R</span>
				<div class="flex-1 h-1.5 rounded-full overflow-hidden bg-dark-border relative">
					<!-- Center marker (0R) -->
					<div class="absolute left-1/2 top-0 w-px h-full bg-gray-500"></div>
					<!-- Value marker -->
					<div
						class="absolute top-0 h-full w-1 rounded-full {metrics.rMultiple >= 0 ? 'bg-green-500' : 'bg-red-500'}"
						style="left: {barPct}%"
					></div>
				</div>
				<span>+3R</span>
			</div>
		</div>
	{/if}
</div>
