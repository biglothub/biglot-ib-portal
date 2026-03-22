<script lang="ts">
	import { theme } from '$lib/stores/theme.svelte';

	let showMenu = $state(false);

	const options: { value: 'dark' | 'light' | 'system'; label: string }[] = [
		{ value: 'dark', label: 'มืด' },
		{ value: 'light', label: 'สว่าง' },
		{ value: 'system', label: 'ระบบ' }
	];

	function select(value: 'dark' | 'light' | 'system') {
		theme.set(value);
		showMenu = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') showMenu = false;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative">
	<button
		onclick={() => showMenu = !showMenu}
		class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors"
		aria-label="เปลี่ยนธีม"
		title="เปลี่ยนธีม"
	>
		{#if theme.resolved === 'dark'}
			<!-- Moon icon -->
			<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
			</svg>
		{:else}
			<!-- Sun icon -->
			<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
			</svg>
		{/if}
	</button>

	{#if showMenu}
		<!-- Backdrop -->
		<button
			class="fixed inset-0 z-40"
			onclick={() => showMenu = false}
			aria-label="ปิดเมนู"
			tabindex="-1"
		></button>

		<!-- Dropdown -->
		<div class="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-dark-border bg-dark-surface shadow-lg overflow-hidden animate-dropdown-in">
			{#each options as opt}
				<button
					onclick={() => select(opt.value)}
					class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors
						{theme.mode === opt.value
							? 'bg-brand-primary/10 text-brand-primary'
							: 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
				>
					{#if opt.value === 'dark'}
						<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
						</svg>
					{:else if opt.value === 'light'}
						<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
					{:else}
						<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
					{/if}
					{opt.label}
					{#if theme.mode === opt.value}
						<svg class="w-3.5 h-3.5 ml-auto text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
