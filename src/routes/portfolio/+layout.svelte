<script lang="ts">
	import { untrack } from 'svelte';
	import { page, navigating } from '$app/stores';
	import { goto, invalidate } from '$app/navigation';
	import { timeAgo } from '$lib/utils';
	import AiChatButton from '$lib/components/portfolio/AiChatButton.svelte';
	import AiChatPanel from '$lib/components/portfolio/AiChatPanel.svelte';
	import PortfolioSkeleton from '$lib/components/portfolio/PortfolioSkeleton.svelte';
	import PortfolioGuide from '$lib/components/portfolio/PortfolioGuide.svelte';
	import { marketNewsStore } from '$lib/stores/newsStore';
	import type { MarketNewsArticle } from '$lib/types';
	import { adminViewAccountId } from '$lib/stores/adminViewStore';
	import { displayUnit, type DisplayUnit } from '$lib/stores/displayUnit';
	import SyncStatusBadge from '$lib/components/portfolio/SyncStatusBadge.svelte';
	import AccountSwitcher from '$lib/components/portfolio/AccountSwitcher.svelte';
	import MobileNav from '$lib/components/layout/MobileNav.svelte';
	import QuickTradeEntry from '$lib/components/portfolio/QuickTradeEntry.svelte';
	import ShortcutsHelp from '$lib/components/shared/ShortcutsHelp.svelte';
	import { registerShortcuts, unregisterShortcuts, initShortcuts, pushOverlay, popOverlay } from '$lib/stores/shortcuts.svelte';
	import CommandPalette from '$lib/components/shared/CommandPalette.svelte';
	import NetworkStatus from '$lib/components/shared/NetworkStatus.svelte';
	import UndoToast from '$lib/components/shared/UndoToast.svelte';

	let { data, children } = $props();
	let { account, allAccounts, isAdminView, viewAsAccountId, bridgeStatus } = $derived(data);
	let chatOpen = $state(false);
	let guideOpen = $state(false);
	let shortcutsOpen = $state(false);
	let commandPaletteRef = $state<CommandPalette | null>(null);

	function areTopPanelsClosed() {
		return !chatOpen && !guideOpen && !shortcutsOpen;
	}

	function openShortcutsHelp() {
		shortcutsOpen = true;
	}

	function openSearch() {
		commandPaletteRef?.openPalette();
	}

	function closeTopPanels() {
		chatOpen = false;
		shortcutsOpen = false;
		guideOpen = false;
	}

	// Initialize keyboard shortcut listener
	// Register shortcuts once — actions read tabHref at invocation time, not registration time
	$effect(() => {
		const destroy = initShortcuts();

		const navShortcuts = [
			{ id: 'nav-overview', keys: ['g+o'], description: 'ภาพรวม', group: 'การนำทาง', enabled: areTopPanelsClosed, action: () => goto(untrack(() => tabHref('/portfolio'))) },
			{ id: 'nav-trades', keys: ['g+t'], description: 'เทรด', group: 'การนำทาง', enabled: areTopPanelsClosed, action: () => goto(untrack(() => tabHref('/portfolio/trades'))) },
			{ id: 'nav-journal', keys: ['g+j'], description: 'บันทึก', group: 'การนำทาง', enabled: areTopPanelsClosed, action: () => goto(untrack(() => tabHref('/portfolio/journal'))) },
			{ id: 'nav-analytics', keys: ['g+a'], description: 'รายงาน', group: 'การนำทาง', enabled: areTopPanelsClosed, action: () => goto(untrack(() => tabHref('/portfolio/analytics'))) },
			{ id: 'nav-notebook', keys: ['g+n'], description: 'สมุดโน้ต', group: 'การนำทาง', enabled: areTopPanelsClosed, action: () => goto(untrack(() => tabHref('/portfolio/notebook'))) },
			{ id: 'nav-playbook', keys: ['g+p'], description: 'Playbook', group: 'การนำทาง', enabled: areTopPanelsClosed, action: () => goto(untrack(() => tabHref('/portfolio/playbook'))) },
			{ id: 'nav-progress', keys: ['g+r'], description: 'ความคืบหน้า', group: 'การนำทาง', enabled: areTopPanelsClosed, action: () => goto(untrack(() => tabHref('/portfolio/progress'))) },
			{ id: 'open-search', keys: ['/', 'Meta+k', 'Control+k'], description: 'ค้นหา', group: 'การค้นหา', enabled: () => !!account && areTopPanelsClosed(), action: openSearch },
			{ id: 'help-modal', keys: ['?'], description: 'แสดง Keyboard Shortcuts', group: 'อื่นๆ', enabled: areTopPanelsClosed, action: openShortcutsHelp },
			{ id: 'close-panels', keys: ['Escape'], description: 'ปิด panel', group: 'อื่นๆ', allowWhenOverlayOpen: true, action: closeTopPanels },
		];

		// Untrack to prevent reading shortcuts $state from becoming a dependency
		// (registerShortcuts reads shortcuts internally, which would cause infinite loop)
		untrack(() => registerShortcuts(navShortcuts));

		return () => {
			untrack(() => unregisterShortcuts(navShortcuts.map(s => s.id)));
			destroy();
		};
	});

	$effect(() => {
		if (chatOpen) untrack(() => pushOverlay('portfolio-chat', { blocksShortcuts: true }));
		else untrack(() => popOverlay('portfolio-chat'));
		return () => untrack(() => popOverlay('portfolio-chat'));
	});

	$effect(() => {
		if (guideOpen) untrack(() => pushOverlay('portfolio-guide', { blocksShortcuts: true }));
		else untrack(() => popOverlay('portfolio-guide'));
		return () => untrack(() => popOverlay('portfolio-guide'));
	});

	$effect(() => {
		if (shortcutsOpen) untrack(() => pushOverlay('portfolio-shortcuts', { blocksShortcuts: true }));
		else untrack(() => popOverlay('portfolio-shortcuts'));
		return () => untrack(() => popOverlay('portfolio-shortcuts'));
	});

	// Pull-to-refresh state
	let pullStartY = $state(0);
	let pullDelta = $state(0);
	let isPulling = $state(false);
	let isRefreshing = $state(false);

	const PULL_THRESHOLD = 72;
	const MAX_PULL_VISUAL = 90;

	const pullProgress = $derived(Math.min(pullDelta / PULL_THRESHOLD, 1));
	const pullIndicatorY = $derived(Math.min(pullDelta, MAX_PULL_VISUAL) - MAX_PULL_VISUAL);

	function handleTouchStart(e: TouchEvent) {
		if (window.scrollY > 0 || isRefreshing) return;
		pullStartY = e.touches[0].clientY;
		isPulling = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isPulling || isRefreshing) return;
		const delta = e.touches[0].clientY - pullStartY;
		if (delta > 0 && window.scrollY === 0) {
			pullDelta = delta;
			e.preventDefault();
		} else {
			pullDelta = 0;
		}
	}

	async function handleTouchEnd() {
		if (!isPulling) return;
		isPulling = false;
		if (pullDelta >= PULL_THRESHOLD) {
			isRefreshing = true;
			pullDelta = 0;
			await invalidate('portfolio:baseData');
			isRefreshing = false;
		} else {
			pullDelta = 0;
		}
	}

	$effect(() => {
		document.addEventListener('touchstart', handleTouchStart, { passive: true });
		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd, { passive: true });
		return () => {
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchmove', handleTouchMove);
			document.removeEventListener('touchend', handleTouchEnd);
		};
	});

	let syncingNow = $state(false);
	let syncError = $state<string | null>(null);
	let syncCooldown = $state(false);

	async function triggerSync() {
		if (syncingNow || syncCooldown || isAdminView) return;
		syncingNow = true;
		syncError = null;
		try {
			const res = await fetch('/api/portfolio/sync-trigger', { method: 'POST' });
			if (res.status === 429) {
				syncError = 'กรุณารอ 60 วินาทีก่อน Sync ใหม่';
			} else if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				syncError = body.message || 'เกิดข้อผิดพลาด';
			} else {
				// Brief cooldown — prevent button spam while bridge processes the request
				syncCooldown = true;
				setTimeout(() => { syncCooldown = false; }, 60_000);
				// Refresh layout data so badge shows updated state
				await invalidate('portfolio:baseData');
			}
		} catch {
			syncError = 'ไม่สามารถเชื่อมต่อได้';
		} finally {
			syncingNow = false;
		}
	}

	const unitOptions: { value: DisplayUnit; label: string }[] = [
		{ value: 'usd', label: '$' },
		{ value: 'pct', label: '%' },
		{ value: 'pips', label: 'p' }
	];

	// The active account_id — from server data, not URL (avoids re-renders from URL changes)
	const activeAccountId = $derived(
		isAdminView ? viewAsAccountId : account?.id || null
	);

	/** Build tab href — preserves account_id param for admin view or account switching */
	const tabHref = (base: string) => {
		if (!activeAccountId) return base;
		return `${base}?account_id=${activeAccountId}`;
	};

	// Set admin view store so child components can build correct links
	$effect(() => {
		adminViewAccountId.set(viewAsAccountId || null);
		return () => adminViewAccountId.set(null);
	});

	// Push market news to the store so the sidebar can display it
	// marketNews may be a streamed promise or already resolved array
	$effect(() => {
		const news = data.marketNews;
		if (news && typeof (news as Promise<MarketNewsArticle[]>).then === 'function') {
			(news as Promise<MarketNewsArticle[]>).then((articles: MarketNewsArticle[]) => marketNewsStore.set(articles || []));
		} else {
			marketNewsStore.set((news as MarketNewsArticle[]) || []);
		}
		return () => marketNewsStore.set([]);
	});

	const tabDefs = [
		{ base: '/portfolio', label: 'ภาพรวม' },
		{ base: '/portfolio/day-view', label: 'รายวัน' },
		{ base: '/portfolio/trades', label: 'เทรด' },
		{ base: '/portfolio/journal', label: 'บันทึก' },
		{ base: '/portfolio/notebook', label: 'สมุดโน้ต' },
		{ base: '/portfolio/analytics', label: 'รายงาน' },
		{ base: '/portfolio/playbook', label: 'Playbook' },
		{ base: '/portfolio/progress', label: 'ความคืบหน้า' },
		{ base: '/portfolio/calendar', label: 'ปฏิทิน' },
		{ base: '/portfolio/live-trade', label: 'เทรดสด' },
		{ base: '/portfolio/analysis', label: 'วิเคราะห์ทอง' },
	];

	const tabs = $derived(tabDefs.map(t => ({ href: tabHref(t.base), base: t.base, label: t.label })));

	const isActive = (base: string) => {
		const path = $page.url.pathname;
		if (base === '/portfolio') return path === '/portfolio';
		return path.startsWith(base);
	};

	// Network status is handled by <NetworkStatus /> component
</script>

<svelte:head>
	<title>{isAdminView ? `${account?.client_name || 'Client'} - Admin View` : 'พอร์ตของฉัน'} - IB Portal</title>
</svelte:head>

<NetworkStatus />

<!-- Pull-to-refresh indicator (mobile only) -->
{#if pullDelta > 0 || isRefreshing}
	<div
		class="md:hidden fixed top-0 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-dark-surface border border-dark-border shadow-lg transition-transform duration-150"
		style="transform: translateX(-50%) translateY({isRefreshing ? '12px' : `${pullIndicatorY + MAX_PULL_VISUAL / 2 - 20}px`})"
		aria-hidden="true"
	>
		<svg
			class="w-5 h-5 {isRefreshing ? 'animate-spin text-brand-primary' : 'text-gray-400'}"
			style={!isRefreshing ? `opacity: ${pullProgress}; transform: rotate(${pullProgress * 180}deg)` : ''}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
		</svg>
	</div>
{/if}

{#if isAdminView}
	<div class="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
			</svg>
			<span class="text-sm text-amber-300">
				Admin View — กำลังดูพอร์ตของ <span class="font-semibold text-white">{account?.client_name}</span>
				<span class="text-amber-400/70 ml-1">(Read-only)</span>
			</span>
		</div>
		<a
			href="/admin/clients/{viewAsAccountId}"
			class="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
		>
			&larr; กลับหน้า Admin
		</a>
	</div>
{/if}

<div
	class="space-y-4 pb-16 md:pb-0 transition-transform duration-150 md:!transform-none"
	style={pullDelta > 0 ? `transform: translateY(${Math.min(pullDelta * 0.3, 24)}px)` : ''}
>
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
		<div class="flex items-center gap-3">
			<h1 class="text-xl font-bold">{isAdminView ? account?.client_name || 'Client Portfolio' : 'พอร์ตของฉัน'}</h1>
			{#if account && !isAdminView}
				<AccountSwitcher currentAccount={account} allAccounts={allAccounts ?? []} />
			{/if}
		</div>
		<div class="flex items-center gap-2 flex-wrap">
			{#if account}
				<SyncStatusBadge lastSyncedAt={account.last_synced_at ?? null} bridgeStatus={bridgeStatus ?? null} />
				{#if !isAdminView}
					<div class="flex flex-col items-end gap-0.5">
						<button
							onclick={triggerSync}
							disabled={syncingNow || syncCooldown}
							class="flex items-center gap-1.5 rounded-lg border border-dark-border px-2.5 py-1.5 text-xs font-medium transition-colors
								{syncingNow || syncCooldown
									? 'text-gray-400 border-gray-700 cursor-not-allowed'
									: 'text-gray-400 hover:text-white hover:border-brand-primary/40'}"
							aria-label={syncCooldown ? 'Sync แล้ว — กรุณารอก่อน' : 'Sync ข้อมูลล่าสุด'}
							title={syncCooldown ? 'Sync แล้ว — กรุณารอก่อน' : 'Sync ข้อมูลล่าสุด'}
						>
							{#if syncingNow}
								<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
								</svg>
								<span>กำลัง Sync...</span>
							{:else}
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
								</svg>
								<span>Sync ตอนนี้</span>
							{/if}
						</button>
						{#if syncError}
							<span class="text-xs text-red-400">{syncError}</span>
						{/if}
					</div>
				{/if}
			{/if}
			<!-- Search button -->
			{#if account}
				<button
					onclick={() => commandPaletteRef?.openPalette()}
					class="flex items-center gap-1.5 rounded-lg border border-dark-border px-2.5 py-1.5 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors"
					aria-label="ค้นหา (Cmd+K)"
					title="ค้นหา (Cmd+K)"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
					</svg>
					<span class="hidden sm:inline">ค้นหา</span>
					<kbd class="hidden sm:inline px-1 rounded bg-dark-bg border border-dark-border font-mono text-gray-400">⌘K</kbd>
				</button>
			{/if}
			<!-- Display unit switcher -->
			<div
				class="flex items-center rounded-lg border border-dark-border overflow-hidden"
				role="group"
				aria-label="หน่วยแสดงผล"
			>
				{#each unitOptions as opt}
					<button
						onclick={() => displayUnit.set(opt.value)}
						class="px-2.5 py-1.5 text-xs font-medium transition-colors
							{$displayUnit === opt.value
								? 'bg-brand-primary/20 text-brand-primary'
								: 'text-gray-400 hover:text-gray-300 hover:bg-dark-border/40'}"
						aria-pressed={$displayUnit === opt.value}
					>
						{opt.label}
					</button>
				{/each}
			</div>
			<button
				onclick={() => guideOpen = true}
				class="flex items-center gap-1.5 rounded-lg border border-dark-border px-2.5 py-1.5 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors"
				aria-label="คู่มือการใช้งาน"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
				</svg>
				<span>คู่มือ</span>
			</button>
			<button
				onclick={() => shortcutsOpen = true}
				class="hidden md:flex items-center gap-1 rounded-lg border border-dark-border px-2 py-1.5 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors font-mono"
				aria-label="แสดง Keyboard Shortcuts"
				title="Keyboard Shortcuts (?)"
			>
				?
			</button>
		</div>
	</div>

	<!-- Desktop tab navigation -->
	<nav class="hidden md:block -mx-1" aria-label="Portfolio navigation">
		<div class="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-dark-border">
			{#each tabs as tab (tab.base)}
				<a
					href={tab.href}
					class="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
						{isActive(tab.base)
							? 'bg-brand-primary/15 text-brand-primary'
							: 'text-gray-400 hover:text-white hover:bg-dark-border/30'}"
					aria-current={isActive(tab.base) ? 'page' : undefined}
				>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>

	{#if $navigating && $navigating.to?.url.pathname.startsWith('/portfolio')}
		<PortfolioSkeleton />
	{:else}
		{@render children()}
	{/if}
</div>

{#if account && !isAdminView}
	<AiChatButton onclick={() => chatOpen = true} />
	<AiChatPanel
		open={chatOpen}
		onclose={() => chatOpen = false}
		accountId={account.id}
		clientName={account.client_name}
	/>
{/if}

<PortfolioGuide open={guideOpen} onclose={() => guideOpen = false} />
<ShortcutsHelp open={shortcutsOpen} onclose={() => shortcutsOpen = false} />

{#if account}
	<MobileNav {tabs} {isActive} />
{/if}

{#if account && !isAdminView}
	<QuickTradeEntry />
{/if}

{#if account}
	<CommandPalette bind:this={commandPaletteRef} accountId={account.id} />
{/if}

<UndoToast />
