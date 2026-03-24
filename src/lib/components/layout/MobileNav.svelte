<script lang="ts">
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';

	interface Tab {
		base: string;
		label: string;
		href: string;
	}

	let { tabs, isActive }: { tabs: Tab[]; isActive: (base: string) => boolean } = $props();

	let moreOpen = $state(false);

	// Primary 4 tabs + "More" button
	const primaryBases = ['/portfolio', '/portfolio/trades', '/portfolio/journal', '/portfolio/analytics'];

	const primaryTabs = $derived(
		primaryBases.map((base) => tabs.find((t) => t.base === base)).filter(Boolean) as Tab[]
	);

	const moreTabs = $derived(tabs.filter((t) => !primaryBases.includes(t.base)));

	// If current page is in "more" section, highlight the More button
	const moreActive = $derived(moreTabs.some((t) => isActive(t.base)));

	function closeMore() {
		moreOpen = false;
	}
</script>

<!-- Bottom drawer backdrop -->
{#if moreOpen}
	<button
		transition:fade={{ duration: 200 }}
		class="md:hidden fixed inset-0 z-40 bg-black/50"
		aria-label="ปิดเมนู"
		onclick={closeMore}
	></button>
{/if}

<!-- "More" slide-up drawer -->
{#if moreOpen}
	<div
		class="md:hidden fixed bottom-16 left-0 right-0 z-50 bg-dark-surface border-t border-dark-border rounded-t-2xl shadow-2xl animate-slide-up"
		role="dialog"
		aria-label="เมนูเพิ่มเติม"
	>
		<div class="p-4 pb-2">
			<div class="w-10 h-1 rounded-full bg-dark-border mx-auto mb-4"></div>
			<p class="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3 px-1">เพิ่มเติม</p>
			<div class="grid grid-cols-4 gap-1">
				{#each moreTabs as tab}
					<a
						href={tab.href}
						onclick={closeMore}
						class="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-colors
							{isActive(tab.base)
								? 'bg-brand-primary/15 text-brand-primary'
								: 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
					>
						<span class="text-[10px] font-medium text-center leading-tight">{tab.label}</span>
					</a>
				{/each}
			</div>
		</div>
	</div>
{/if}

<!-- Fixed bottom navigation bar (mobile only) -->
<nav
	class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark-surface border-t border-dark-border flex items-stretch"
	aria-label="เมนูหลัก"
>
	{#each primaryTabs as tab}
		<a
			href={tab.href}
			class="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors
				{isActive(tab.base)
					? 'text-brand-primary'
					: 'text-gray-400 hover:text-gray-300'}"
			aria-current={isActive(tab.base) ? 'page' : undefined}
		>
			{#if tab.base === '/portfolio'}
				<!-- Home / Overview icon -->
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
			{:else if tab.base === '/portfolio/trades'}
				<!-- Trades icon -->
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
			{:else if tab.base === '/portfolio/journal'}
				<!-- Journal icon -->
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
			{:else if tab.base === '/portfolio/analytics'}
				<!-- Analytics icon -->
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
			{/if}
			<span class="text-[10px] font-medium leading-tight">{tab.label}</span>
		</a>
	{/each}

	<!-- More button -->
	<button
		class="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors
			{moreActive || moreOpen
				? 'text-brand-primary'
				: 'text-gray-400 hover:text-gray-300'}"
		onclick={() => (moreOpen = !moreOpen)}
		aria-expanded={moreOpen}
		aria-haspopup="dialog"
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
		</svg>
		<span class="text-[10px] font-medium leading-tight">เพิ่มเติม</span>
	</button>
</nav>
