<script lang="ts">
	import { page } from '$app/stores';
	import { timeAgo } from '$lib/utils';
	import AiChatButton from '$lib/components/portfolio/AiChatButton.svelte';
	import AiChatPanel from '$lib/components/portfolio/AiChatPanel.svelte';

	let { data, children } = $props();
	let { account } = $derived(data);
	let chatOpen = $state(false);

	const tabs = [
		{ href: '/portfolio', label: 'ภาพรวม', icon: '📊' },
		{ href: '/portfolio/trades', label: 'Trades', icon: '📋' },
		{ href: '/portfolio/journal', label: 'Journal', icon: '📝' },
		{ href: '/portfolio/analytics', label: 'Analytics', icon: '📈' },
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
		{#if account?.last_synced_at}
			<span class="text-xs text-gray-500">อัพเดท: {timeAgo(account.last_synced_at)}</span>
		{/if}
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
					class="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
						{isActive(tab.href)
							? 'text-brand-primary border-b-2 border-brand-primary'
							: 'text-gray-500 hover:text-gray-300'}"
				>
					<span class="text-xs">{tab.icon}</span>
					{tab.label}
				</a>
			{/each}
		</div>
	{/if}

	{@render children()}
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
