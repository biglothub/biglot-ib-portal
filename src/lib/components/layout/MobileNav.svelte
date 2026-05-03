<script lang="ts">
	import { focusTrap } from '$lib/actions/focusTrap';
	import { openInstallPrompt } from '$lib/pwa/install-event.svelte';
	import { usePlatform } from '$lib/pwa/use-platform.svelte';
	import { fade } from 'svelte/transition';

	interface Tab {
		base: string;
		label: string;
		href: string;
	}

	interface DrawerAction {
		label: string;
		href?: string;
		action?: () => void;
		tone?: 'default' | 'danger';
	}

	let { tabs, isActive }: { tabs: Tab[]; isActive: (base: string) => boolean } = $props();

	let moreOpen = $state(false);
	let touchStartY = $state(0);
	let touchDeltaY = $state(0);
	const platform = usePlatform();

	// Primary 4 tabs + "More" button
	const primaryBases = ['/portfolio', '/portfolio/trades', '/portfolio/journal', '/portfolio/analytics'];

	const primaryTabs = $derived(
		primaryBases.map((base) => tabs.find((t) => t.base === base)).filter(Boolean) as Tab[]
	);

	const moreTabs = $derived(tabs.filter((t) => !primaryBases.includes(t.base)));

	// If current page is in "more" section, highlight the More button
	const moreActive = $derived(moreTabs.some((t) => isActive(t.base)));

	const findTab = (base: string): DrawerAction | null => {
		const tab = tabs.find((t) => t.base === base);
		return tab ? { label: tab.label, href: tab.href } : null;
	};

	const toolActions = $derived(
		[
			findTab('/portfolio/calendar'),
			findTab('/portfolio/live-trade'),
			findTab('/portfolio/ai'),
			findTab('/portfolio/day-view')
		].filter(Boolean) as DrawerAction[]
	);

	const accountActions = $derived([
		{ label: 'ตั้งค่า', href: '/settings' },
		{ label: 'แจ้งเตือน', href: '/settings/alerts' },
		{ label: 'คู่มือ', href: '/guide.html' },
		...moreTabs
			.filter((tab) => !toolActions.some((action) => action.href === tab.href))
			.map((tab) => ({ label: tab.label, href: tab.href }))
	]);

	const systemActions = $derived(
		[
			!platform.isStandalone
				? { label: 'ติดตั้งแอป', action: () => openInstallPrompt() }
				: null
		].filter(Boolean) as DrawerAction[]
	);

	function closeMore() {
		moreOpen = false;
		touchDeltaY = 0;
	}

	function handleDrawerKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeMore();
	}

	function handleAction(action: DrawerAction) {
		action.action?.();
		closeMore();
	}

	function handleTouchStart(e: TouchEvent) {
		touchStartY = e.touches[0].clientY;
		touchDeltaY = 0;
	}

	function handleTouchMove(e: TouchEvent) {
		touchDeltaY = Math.max(0, e.touches[0].clientY - touchStartY);
	}

	function handleTouchEnd() {
		if (touchDeltaY > 56) closeMore();
		else touchDeltaY = 0;
	}

	$effect(() => {
		if (!moreOpen) return;
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = originalOverflow;
		};
	});
</script>

{#snippet DrawerSection(title: string, actions: DrawerAction[])}
	{#if actions.length > 0}
		<section class="space-y-1">
			<p class="px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</p>
			<div class="grid grid-cols-2 gap-1.5">
				{#each actions as action}
					{#if action.href}
						<a
							href={action.href}
							onclick={closeMore}
							class="pwa-min-touch flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors
								{action.tone === 'danger'
									? 'text-red-400 hover:bg-red-400/10'
									: 'text-gray-300 hover:bg-dark-hover hover:text-white'}"
						>
							<span class="min-w-0 truncate">{action.label}</span>
						</a>
					{:else}
						<button
							type="button"
							onclick={() => handleAction(action)}
							class="pwa-min-touch flex items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors
								{action.tone === 'danger'
									? 'text-red-400 hover:bg-red-400/10'
									: 'text-gray-300 hover:bg-dark-hover hover:text-white'}"
						>
							<span class="min-w-0 truncate">{action.label}</span>
						</button>
					{/if}
				{/each}
			</div>
		</section>
	{/if}
{/snippet}

<!-- Bottom drawer backdrop -->
{#if moreOpen}
	<button
		type="button"
		transition:fade={{ duration: 200 }}
		class="md:hidden fixed inset-0 z-[39] bg-black/50"
		aria-label="ปิดเมนู"
		onclick={closeMore}
		tabindex="-1"
		aria-hidden="true"
	></button>
{/if}

<!-- "More" slide-up drawer -->
{#if moreOpen}
	<div
		use:focusTrap={{ enabled: moreOpen }}
		class="md:hidden fixed left-0 right-0 z-[40] bg-dark-surface border-t border-dark-border rounded-t-2xl shadow-2xl animate-slide-up"
		style="bottom: calc(56px + var(--pwa-safe-bottom)); transform: translateY({touchDeltaY}px); transition: {touchDeltaY > 0 ? 'none' : 'transform 160ms ease'}"
		role="dialog"
		aria-modal="true"
		aria-labelledby="more-menu-title"
		tabindex="-1"
		onkeydown={handleDrawerKeydown}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		<div class="space-y-4 p-4 pb-3">
			<div class="mx-auto h-1 w-10 rounded-full bg-dark-border"></div>
			<p id="more-menu-title" class="px-1 text-xs font-medium uppercase tracking-widest text-gray-400">เพิ่มเติม</p>

			{@render DrawerSection('Tools', toolActions)}
			{@render DrawerSection('Account', accountActions)}
			{@render DrawerSection('System', systemActions)}

			<div class="border-t border-dark-border pt-3">
				<form method="POST" action="/auth/logout">
					<button type="submit" class="pwa-min-touch flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-400/10">
						<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
						ออกจากระบบ
					</button>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Fixed bottom navigation bar (mobile only) -->
<nav
	class="md:hidden fixed bottom-0 left-0 right-0 z-[20] bg-dark-surface border-t border-dark-border flex items-stretch pwa-safe-bottom"
	aria-label="เมนูหลัก"
>
	{#each primaryTabs as tab}
		<a
			href={tab.href}
			class="pwa-min-touch flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors
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
		class="pwa-min-touch flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors
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
