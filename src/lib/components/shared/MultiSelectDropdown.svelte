<script lang="ts">
	let {
		label,
		options,
		selected = $bindable([]),
	}: {
		label: string;
		options: { value: string; label: string }[];
		selected: string[];
	} = $props();

	let open = $state(false);
	let ref: HTMLDivElement;

	function toggle(value: string) {
		if (selected.includes(value)) {
			selected = selected.filter((v) => v !== value);
		} else {
			selected = [...selected, value];
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (ref && !ref.contains(e.target as Node)) {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside, true);
			return () => document.removeEventListener('click', handleClickOutside, true);
		}
	});
</script>

<div class="relative" bind:this={ref}>
	<button
		type="button"
		onclick={() => (open = !open)}
		class="w-full flex items-center justify-between gap-2 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-left
			{selected.length > 0 ? 'text-white' : 'text-gray-500'}"
	>
		<span class="truncate">
			{#if selected.length === 0}
				{label}
			{:else if selected.length === 1}
				{options.find((o) => o.value === selected[0])?.label || selected[0]}
			{:else}
				{label} ({selected.length})
			{/if}
		</span>
		<svg class="w-3.5 h-3.5 shrink-0 text-gray-500 transition-transform {open ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if open}
		<div class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded border border-dark-border bg-dark-card shadow-lg">
			{#each options as option}
				<button
					type="button"
					onclick={() => toggle(option.value)}
					class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-dark-bg/60 text-left
						{selected.includes(option.value) ? 'text-white' : 'text-gray-400'}"
				>
					<span class="w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px]
						{selected.includes(option.value) ? 'bg-brand-primary border-brand-primary text-white' : 'border-dark-border'}">
						{#if selected.includes(option.value)}✓{/if}
					</span>
					<span class="truncate">{option.label}</span>
				</button>
			{/each}
			{#if options.length === 0}
				<div class="px-3 py-2 text-xs text-gray-500">No options</div>
			{/if}
		</div>
	{/if}
</div>
