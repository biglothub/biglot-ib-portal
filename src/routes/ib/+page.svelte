<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, timeAgo } from '$lib/utils';

	let { data } = $props();
	let { clients, statsMap, kpis } = $derived(data);
</script>

<svelte:head>
	<title>Dashboard - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold">Dashboard</h1>
		<a href="/ib/clients/add" class="btn-primary text-sm">เพิ่มลูกค้า</a>
	</div>

	<!-- KPIs -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<MetricCard label="ลูกค้า" value={String(kpis.totalClients)} />
		<MetricCard
			label="รออนุมัติ"
			value={String(kpis.pendingClients)}
			color={kpis.pendingClients > 0 ? 'text-yellow-400' : 'text-white'}
		/>
		<MetricCard label="AUM รวม" value={formatCurrency(kpis.totalBalance, 0)} color="text-green-400" />
		<MetricCard
			label="กำไร/ขาดทุนรวม"
			value={formatCurrency(kpis.totalProfit, 0)}
			color={kpis.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}
		/>
	</div>

	<!-- Client List -->
	<div class="card">
		<h2 class="text-sm font-medium text-gray-400 mb-4">ลูกค้าทั้งหมด</h2>
		{#if clients.length === 0}
			<EmptyState message="ยังไม่มีลูกค้า กดปุ่ม 'เพิ่มลูกค้า' เพื่อเริ่มต้น" icon="👤" />
		{:else}
			<div class="space-y-2">
				{#each clients as client}
					{@const stats = statsMap[client.id]}
					<a
						href={['approved', 'rejected'].includes(client.status) ? `/ib/clients/${client.id}` : '#'}
						class="flex items-center gap-4 p-3 rounded-lg hover:bg-dark-hover transition-colors
							{!['approved', 'rejected'].includes(client.status) ? 'opacity-60 cursor-default' : ''}"
					>
						<div class="w-9 h-9 rounded-full bg-dark-border flex items-center justify-center text-sm font-medium text-gray-300">
							{client.client_name.charAt(0)}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium text-white truncate">{client.client_name}</p>
								<StatusBadge status={client.status} />
							</div>
							<p class="text-xs text-gray-400">MT5: {client.mt5_account_id}</p>
						</div>
						{#if stats}
							<div class="text-right shrink-0">
								<p class="text-sm font-medium text-white">{formatCurrency(stats.balance, 0)}</p>
								<p class="text-xs {stats.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
									{formatCurrency(stats.profit, 0)}
								</p>
							</div>
						{:else if client.status === 'approved'}
							<p class="text-xs text-gray-400">รอ sync...</p>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
