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
	{#if sections.length > 0}
		{#each sections as section}
			<div>
				<h3 class="text-xs uppercase tracking-wider text-gray-400 mb-2">{section.title}</h3>
				<div class="rounded-xl border border-gray-700/50 overflow-hidden">
					{#each section.rows as row, i}
						<div class="flex items-center justify-between px-4 py-2.5 text-sm
							{i % 2 === 0 ? 'bg-dark-surface/50' : 'bg-dark-bg/30'}
							{i < section.rows.length - 1 ? 'border-b border-gray-700/30' : ''}">
							<span class="text-gray-400">{row.label}</span>
							<span class="font-mono font-medium {row.color || 'text-white'}">{row.value}</span>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{:else}
		<div class="flex flex-col items-center justify-center py-8 text-gray-400">
			<svg class="w-8 h-8 mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v.75" />
			</svg>
			<p class="text-sm">ยังไม่มีข้อมูลสถิติ</p>
		</div>
	{/if}
</div>
