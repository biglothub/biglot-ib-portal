<script lang="ts">
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, timeAgo } from '$lib/utils';

	let { data } = $props();
	let { clients, statsMap } = $derived(data);

	let filter = $state('all');

	const filteredClients = $derived(
		filter === 'all' ? clients : clients.filter((c: any) => c.status === filter)
	);

	const tabs = [
		{ value: 'all', label: 'ทั้งหมด' },
		{ value: 'approved', label: 'อนุมัติแล้ว' },
		{ value: 'pending', label: 'รออนุมัติ' },
		{ value: 'rejected', label: 'ถูกปฏิเสธ' },
	];
</script>

<svelte:head>
	<title>ลูกค้าของฉัน - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold">ลูกค้าของฉัน</h1>
		<a href="/ib/clients/add" class="btn-primary text-sm">เพิ่มลูกค้า</a>
	</div>

	<!-- Filter tabs -->
	<div class="flex gap-2">
		{#each tabs as tab}
			<button
				class="px-3 py-1.5 rounded-lg text-sm transition-colors
					{filter === tab.value ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
				onclick={() => filter = tab.value}
			>
				{tab.label}
				{#if tab.value !== 'all'}
					<span class="ml-1 text-xs opacity-70">
						({clients.filter((c: any) => c.status === tab.value).length})
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Client List -->
	<div class="card">
		{#if filteredClients.length === 0}
			<EmptyState message="ไม่พบลูกค้า" icon="👤" />
		{:else}
			<div class="space-y-2">
				{#each filteredClients as client}
					{@const stats = statsMap[client.id]}
					<a
						href={client.status !== 'suspended' ? `/ib/clients/${client.id}` : '#'}
						class="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-hover transition-colors
							{client.status === 'suspended' ? 'opacity-60 cursor-default' : ''}"
					>
						<div class="w-9 h-9 rounded-full bg-dark-border flex items-center justify-center text-sm font-medium text-gray-300">
							{client.client_name.charAt(0)}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium text-white truncate">{client.client_name}</p>
								<StatusBadge status={client.status} />
							</div>
							<p class="text-xs text-gray-500">MT5: {client.mt5_account_id}</p>
							{#if client.status === 'rejected' && client.rejection_reason}
								<p class="text-xs text-red-400 mt-0.5 truncate">เหตุผล: {client.rejection_reason}</p>
							{/if}
						</div>
						{#if stats}
							<div class="text-right shrink-0">
								<p class="text-sm font-medium text-white">{formatCurrency(stats.balance, 0)}</p>
								<p class="text-xs {stats.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
									{formatCurrency(stats.profit, 0)}
								</p>
							</div>
						{:else if client.status === 'approved'}
							<p class="text-xs text-gray-500">รอ sync...</p>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
