<script lang="ts">
	import { page, navigating } from '$app/stores';
	import { timeAgo } from '$lib/utils';
	import AiChatButton from '$lib/components/portfolio/AiChatButton.svelte';
	import AiChatPanel from '$lib/components/portfolio/AiChatPanel.svelte';
	import PortfolioSkeleton from '$lib/components/portfolio/PortfolioSkeleton.svelte';
	import PortfolioGuide from '$lib/components/portfolio/PortfolioGuide.svelte';
	import { marketNewsStore } from '$lib/stores/newsStore';

	let { data, children } = $props();
	let { account } = $derived(data);
	let chatOpen = $state(false);
	let guideOpen = $state(false);

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

	const tabs = [
		{ href: '/portfolio', label: 'Overview' },
		{ href: '/portfolio/day-view', label: 'Day View' },
		{ href: '/portfolio/trades', label: 'Trades' },
		{ href: '/portfolio/journal', label: 'Journal' },
		{ href: '/portfolio/notebook', label: 'Notebook' },
		{ href: '/portfolio/analytics', label: 'Reports' },
		{ href: '/portfolio/playbook', label: 'Playbook' },
		{ href: '/portfolio/progress', label: 'Progress' },
		{ href: '/portfolio/live-trade', label: 'Live Trade' },
		{ href: '/portfolio/analysis', label: 'Gold Analysis' },
	];

	const isActive = (href: string) => {
		const path = $page.url.pathname;
		if (href === '/portfolio') return path === '/portfolio';
		return path.startsWith(href);
	};
</script>

<svelte:head>
	<title>พอร์ตของฉัน - IB Portal</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold">พอร์ตของฉัน</h1>
		<div class="flex items-center gap-3">
			{#if account?.last_synced_at}
				<span class="text-xs text-gray-500">อัพเดท: {timeAgo(account.last_synced_at)}</span>
			{/if}
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
						{isActive(tab.href)
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

{#if account}
	<AiChatButton onclick={() => chatOpen = true} />
	<AiChatPanel
		open={chatOpen}
		onclose={() => chatOpen = false}
		accountId={account.id}
		clientName={account.client_name}
	/>
{/if}

<PortfolioGuide open={guideOpen} onclose={() => guideOpen = false} />
