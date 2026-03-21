<script lang="ts">
	let {
		label,
		options,
		selected = $bindable([]),
		searchable = false,
		groupBy = false,
		showSelectAll = false,
		onchange
	}: {
		label: string;
		options: { value: string; label: string; group?: string; color?: string }[];
		selected: string[];
		searchable?: boolean;
		groupBy?: boolean;
		showSelectAll?: boolean;
		onchange?: () => void;
	} = $props();

	let open = $state(false);
	let searchQuery = $state('');
	let focusIndex = $state(-1);
	let ref: HTMLDivElement;
	let searchRef = $state<HTMLInputElement | undefined>();

	let filteredOptions = $derived(
		searchable && searchQuery.trim()
			? options.filter((o) => o.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
			: options
	);

	let groupedOptions = $derived.by(() => {
		if (!groupBy) return null;
		const groups = new Map<string, typeof filteredOptions>();
		for (const opt of filteredOptions) {
			const key = opt.group || '';
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(opt);
		}
		return groups;
	});

	function toggle(value: string) {
		if (selected.includes(value)) {
			selected = selected.filter((v) => v !== value);
		} else {
			selected = [...selected, value];
		}
		onchange?.();
	}

	function selectAll() {
		selected = filteredOptions.map((o) => o.value);
		onchange?.();
	}

	function clearAll() {
		selected = [];
		onchange?.();
	}

	function handleClickOutside(e: MouseEvent) {
		if (ref && !ref.contains(e.target as Node)) {
			open = false;
			searchQuery = '';
			focusIndex = -1;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		const flatOptions = filteredOptions;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			focusIndex = Math.min(focusIndex + 1, flatOptions.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			focusIndex = Math.max(focusIndex - 1, 0);
		} else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < flatOptions.length) {
			e.preventDefault();
			toggle(flatOptions[focusIndex].value);
		} else if (e.key === 'Escape') {
			open = false;
			searchQuery = '';
			focusIndex = -1;
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside, true);
			if (searchable) {
				requestAnimationFrame(() => searchRef?.focus());
			}
			return () => document.removeEventListener('click', handleClickOutside, true);
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative" bind:this={ref} onkeydown={handleKeydown}>
	<button
		type="button"
		onclick={() => { open = !open; focusIndex = -1; searchQuery = ''; }}
		aria-expanded={open}
		aria-haspopup="listbox"
		aria-label="{label}{selected.length > 0 ? ` (${selected.length} เลือก)` : ''}"
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
		<div class="absolute z-50 mt-1 w-full rounded border border-dark-border bg-dark-card shadow-lg animate-dropdown-in" role="listbox" aria-label={label} aria-multiselectable="true">
			{#if searchable}
				<div class="sticky top-0 bg-dark-card border-b border-dark-border p-1.5">
					<input
						bind:this={searchRef}
						bind:value={searchQuery}
						type="text"
						placeholder="ค้นหา..."
						class="w-full bg-dark-bg border border-dark-border rounded px-2 py-1 text-xs text-white placeholder-gray-600"
						aria-label="ค้นหาตัวเลือก"
					/>
				</div>
			{/if}

			{#if showSelectAll}
				<div class="flex items-center gap-2 px-3 py-1.5 border-b border-dark-border">
					<button type="button" onclick={selectAll} class="text-xs text-brand-primary hover:text-brand-primary/80">เลือกทั้งหมด</button>
					<span class="text-gray-600 text-xs">|</span>
					<button type="button" onclick={clearAll} class="text-xs text-gray-400 hover:text-white">ล้าง</button>
				</div>
			{/if}

			<div class="max-h-48 overflow-y-auto">
				{#if groupBy && groupedOptions}
					{#each [...groupedOptions.entries()] as [groupName, groupOpts], gi}
						{#if groupName}
							<div class="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider {gi > 0 ? 'border-t border-dark-border mt-1' : ''}">
								{groupName}
							</div>
						{/if}
						{#each groupOpts as option}
							{@const idx = filteredOptions.indexOf(option)}
							<button
								type="button"
								role="option"
								aria-selected={selected.includes(option.value)}
								onclick={() => toggle(option.value)}
								class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-dark-bg/60 text-left
									{selected.includes(option.value) ? 'text-white' : 'text-gray-400'}
									{focusIndex === idx ? 'bg-dark-bg/40' : ''}"
							>
								<span class="w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px]
									{selected.includes(option.value) ? 'bg-brand-primary border-brand-primary text-white' : 'border-dark-border'}">
									{#if selected.includes(option.value)}✓{/if}
								</span>
								{#if option.color}
									<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {option.color}"></span>
								{/if}
								<span class="truncate">{option.label}</span>
							</button>
						{/each}
					{/each}
				{:else}
					{#each filteredOptions as option, idx}
						<button
							type="button"
							role="option"
							aria-selected={selected.includes(option.value)}
							onclick={() => toggle(option.value)}
							class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-dark-bg/60 text-left
								{selected.includes(option.value) ? 'text-white' : 'text-gray-400'}
								{focusIndex === idx ? 'bg-dark-bg/40' : ''}"
						>
							<span class="w-4 h-4 rounded border shrink-0 flex items-center justify-center text-[10px]
								{selected.includes(option.value) ? 'bg-brand-primary border-brand-primary text-white' : 'border-dark-border'}">
								{#if selected.includes(option.value)}✓{/if}
							</span>
							{#if option.color}
								<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {option.color}"></span>
							{/if}
							<span class="truncate">{option.label}</span>
						</button>
					{/each}
				{/if}

				{#if filteredOptions.length === 0}
					<div class="px-3 py-2 text-xs text-gray-500">
						{searchQuery ? 'ไม่พบผลลัพธ์' : 'ไม่มีตัวเลือก'}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
