<script lang="ts">
	import { page, navigating } from '$app/stores';
	import { beforeNavigate, goto, invalidate } from '$app/navigation';
	import { timeAgo } from '$lib/utils';
	import AiChatButton from '$lib/components/portfolio/AiChatButton.svelte';
	import AiChatPanel from '$lib/components/portfolio/AiChatPanel.svelte';
	import PortfolioSkeleton from '$lib/components/portfolio/PortfolioSkeleton.svelte';
	import PortfolioGuide from '$lib/components/portfolio/PortfolioGuide.svelte';
	import { marketNewsStore } from '$lib/stores/newsStore';
	import { adminViewAccountId } from '$lib/stores/adminViewStore';
	import { displayUnit, type DisplayUnit } from '$lib/stores/displayUnit';
	import SyncStatusBadge from '$lib/components/portfolio/SyncStatusBadge.svelte';

	let { data, children } = $props();
	let { account, isAdminView, viewAsAccountId, bridgeStatus } = $derived(data);
	let chatOpen = $state(false);
	let guideOpen = $state(false);

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

	/** Build tab href — preserves account_id param for admin view */
	const tabHref = (base: string) => {
		if (!isAdminView || !viewAsAccountId) return base;
		return `${base}?account_id=${viewAsAccountId}`;
	};

	// Set admin view store so child components can build correct links
	$effect(() => {
		adminViewAccountId.set(viewAsAccountId || null);
		return () => adminViewAccountId.set(null);
	});

	// Auto-append account_id to all portfolio navigations in admin view
	beforeNavigate(({ to, cancel }) => {
		if (!isAdminView || !viewAsAccountId || !to?.url) return;
		if (to.url.pathname.startsWith('/portfolio') && !to.url.searchParams.has('account_id')) {
			cancel();
			const url = new URL(to.url);
			url.searchParams.set('account_id', viewAsAccountId);
			goto(url.pathname + url.search, { replaceState: false });
		}
	});

	// Push market news to the store so the sidebar can display it
	// marketNews may be a streamed promise or already resolved array
	$effect(() => {
		const news = data.marketNews;
		if (news && typeof (news as any).then === 'function') {
			(news as any).then((articles: any[]) => marketNewsStore.set(articles || []));
		} else {
			marketNewsStore.set((news as any[]) || []);
		}
		return () => marketNewsStore.set([]);
	});

	const tabDefs = [
		{ base: '/portfolio', label: 'Overview' },
		{ base: '/portfolio/day-view', label: 'Day View' },
		{ base: '/portfolio/trades', label: 'Trades' },
		{ base: '/portfolio/journal', label: 'Journal' },
		{ base: '/portfolio/notebook', label: 'Notebook' },
		{ base: '/portfolio/analytics', label: 'Reports' },
		{ base: '/portfolio/playbook', label: 'Playbook' },
		{ base: '/portfolio/progress', label: 'Progress' },
		{ base: '/portfolio/calendar', label: 'Calendar' },
		{ base: '/portfolio/live-trade', label: 'Live Trade' },
		{ base: '/portfolio/analysis', label: 'Gold Analysis' },
	];

	const tabs = $derived(tabDefs.map(t => ({ href: tabHref(t.base), base: t.base, label: t.label })));

	const isActive = (base: string) => {
		const path = $page.url.pathname;
		if (base === '/portfolio') return path === '/portfolio';
		return path.startsWith(base);
	};
</script>

<svelte:head>
	<title>{isAdminView ? `${account?.client_name || 'Client'} - Admin View` : 'พอร์ตของฉัน'} - IB Portal</title>
</svelte:head>

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

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold">{isAdminView ? account?.client_name || 'Client Portfolio' : 'พอร์ตของฉัน'}</h1>
		<div class="flex items-center gap-3">
			{#if account}
				<SyncStatusBadge lastSyncedAt={account.last_synced_at ?? null} bridgeStatus={bridgeStatus ?? null} />
				{#if !isAdminView}
					<div class="flex flex-col items-end gap-0.5">
						<button
							onclick={triggerSync}
							disabled={syncingNow || syncCooldown}
							class="flex items-center gap-1.5 rounded-lg border border-dark-border px-2.5 py-1.5 text-xs font-medium transition-colors
								{syncingNow || syncCooldown
									? 'text-gray-600 border-gray-700 cursor-not-allowed'
									: 'text-gray-400 hover:text-white hover:border-brand-primary/40'}"
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
								<span>Sync Now</span>
							{/if}
						</button>
						{#if syncError}
							<span class="text-xs text-red-400">{syncError}</span>
						{/if}
					</div>
				{/if}
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
								: 'text-gray-500 hover:text-gray-300 hover:bg-dark-border/40'}"
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
		</div>
	</div>

	{#if account}
		<!-- Account info -->
		<div class="text-sm text-gray-500">
			MT5: {account.mt5_account_id} @ {account.mt5_server}
		</div>

		<!-- Tab Navigation -->
		<div class="flex gap-1 border-b border-dark-border overflow-x-auto">
			{#each tabs as tab}
				<a
					href={tab.href}
					data-sveltekit-preload-data="tap"
					class="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
						{isActive(tab.base)
							? 'text-brand-primary border-b-2 border-brand-primary'
							: 'text-gray-500 hover:text-gray-300'}"
				>
					{tab.label}
				</a>
			{/each}
		</div>
	{/if}

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
