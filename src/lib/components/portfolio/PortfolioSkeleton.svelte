<div class="space-y-6 animate-pulse">
	<!-- Metric Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		{#each Array(4) as _}
			<div class="card">
				<div class="h-3 w-16 rounded bg-dark-border/50 mb-2"></div>
				<div class="h-7 w-24 rounded bg-dark-border/50"></div>
			</div>
		{/each}
	</div>

	<!-- Chart -->
	<div class="card">
		<div class="h-3 w-20 rounded bg-dark-border/50 mb-3"></div>
		<div class="h-48 rounded-lg bg-dark-border/30"></div>
	</div>

	<!-- 3-column Cards -->
	<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
		{#each Array(3) as _}
			<div class="card space-y-3">
				<div class="h-3 w-24 rounded bg-dark-border/50"></div>
				<div class="h-5 w-32 rounded bg-dark-border/50"></div>
				<div class="space-y-2 mt-2">
					{#each Array(3) as __}
						<div class="h-12 rounded-xl bg-dark-border/30"></div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
