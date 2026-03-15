<!-- Skeleton that matches the Overview page layout exactly -->
<div class="space-y-6 animate-pulse">
	<!-- KPI Cards Row 1 -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		{#each Array(4) as _}
			<div class="card">
				<div class="h-3 w-20 bg-dark-border/50 rounded mb-3"></div>
				<div class="h-7 w-28 bg-dark-border/30 rounded"></div>
			</div>
		{/each}
	</div>

	<!-- KPI Cards Row 2 -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		{#each Array(4) as _}
			<div class="card">
				<div class="h-3 w-16 bg-dark-border/50 rounded mb-3"></div>
				<div class="h-7 w-24 bg-dark-border/30 rounded"></div>
			</div>
		{/each}
	</div>

	<!-- Chart area -->
	<div class="card">
		<div class="flex items-center justify-between mb-4">
			<div class="h-5 w-40 bg-dark-border/50 rounded"></div>
			<div class="flex gap-1">
				{#each Array(5) as _}
					<div class="h-7 w-10 bg-dark-border/30 rounded"></div>
				{/each}
			</div>
		</div>
		<div class="h-[220px] bg-dark-border/20 rounded-lg"></div>
	</div>

	<!-- 4-column grid -->
	<div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
		{#each Array(4) as _}
			<div class="card">
				<div class="h-3 w-24 bg-dark-border/50 rounded mb-3"></div>
				<div class="h-5 w-32 bg-dark-border/30 rounded mb-4"></div>
				<div class="space-y-3">
					{#each Array(3) as _}
						<div class="h-12 bg-dark-border/20 rounded-xl"></div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<!-- 3-column grid -->
	<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
		{#each Array(3) as _}
			<div class="card">
				<div class="h-3 w-28 bg-dark-border/50 rounded mb-3"></div>
				<div class="space-y-2">
					{#each Array(3) as _}
						<div class="h-14 bg-dark-border/20 rounded-xl"></div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
