<script lang="ts">
	const steps = [
		{
			label: '1 กดแชร์',
			icon: 'share'
		},
		{
			label: '2 เพิ่มในหน้าจอโฮม',
			icon: 'home'
		},
		{
			label: '3 เปิดจากไอคอน IB Portal',
			icon: 'app'
		}
	] as const;
</script>

<div class="mt-3 grid gap-2" aria-label="ขั้นตอนติดตั้งบน iPhone">
	{#each steps as step}
		<div class="flex min-h-11 items-center gap-3 rounded-lg border border-dark-border bg-dark-bg/70 px-3 py-2">
			<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary/15 text-brand-primary">
				{#if step.icon === 'share'}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
					</svg>
				{:else if step.icon === 'home'}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m-7-7h14" />
					</svg>
				{:else}
					<span class="text-[10px] font-bold leading-none">IB</span>
				{/if}
			</div>
			<span class="text-xs font-medium text-gray-300">{step.label}</span>
		</div>
	{/each}
</div>
