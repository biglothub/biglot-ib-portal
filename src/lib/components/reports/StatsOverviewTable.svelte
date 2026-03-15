<script lang="ts">
	let {
		sections = []
	}: {
		sections?: Array<{
			title: string;
			rows: Array<{ label: string; value: string; color?: string }>;
		}>;
	} = $props();
</script>

<div class="space-y-4">
	{#each sections as section}
		<div>
			<h3 class="text-xs uppercase tracking-wider text-gray-500 mb-2">{section.title}</h3>
			<div class="rounded-xl border border-dark-border overflow-hidden">
				{#each section.rows as row, i}
					<div class="flex items-center justify-between px-4 py-2.5 text-sm
						{i % 2 === 0 ? 'bg-dark-surface/50' : 'bg-dark-bg/30'}
						{i < section.rows.length - 1 ? 'border-b border-dark-border/30' : ''}">
						<span class="text-gray-400">{row.label}</span>
						<span class="font-mono font-medium {row.color || 'text-white'}">{row.value}</span>
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>
