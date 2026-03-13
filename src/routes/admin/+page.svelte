<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, timeAgo } from '$lib/utils';

	let { data } = $props();
	let { kpis, recentActivity } = $derived(data);
</script>

<svelte:head>
	<title>Admin Dashboard - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-xl font-bold">Admin Dashboard</h1>

	<!-- KPIs -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<MetricCard
			label="รออนุมัติ"
			value={String(kpis.pendingCount)}
			color={kpis.pendingCount > 0 ? 'text-yellow-400' : 'text-white'}
		/>
		<MetricCard label="Master IBs" value={String(kpis.totalIBs)} />
		<MetricCard label="ลูกค้า (approved)" value={String(kpis.totalClients)} />
		<MetricCard label="AUM รวม" value={formatCurrency(kpis.totalAUM, 0)} color="text-green-400" />
	</div>

	<!-- Quick Actions -->
	<div class="flex gap-3">
		{#if kpis.pendingCount > 0}
			<a href="/admin/approvals" class="btn-primary text-sm">
				อนุมัติลูกค้า ({kpis.pendingCount})
			</a>
		{/if}
		<a href="/admin/ibs" class="btn-secondary text-sm">จัดการ Master IBs</a>
	</div>

	<!-- Recent Activity -->
	<div class="card">
		<h2 class="text-sm font-medium text-gray-400 mb-4">กิจกรรมล่าสุด</h2>
		{#if recentActivity.length === 0}
			<EmptyState message="ยังไม่มีกิจกรรม" />
		{:else}
			<div class="space-y-3">
				{#each recentActivity as log}
					<div class="flex items-start gap-3 text-sm">
						<span class="text-base">
							{log.action === 'approved' ? '✅' :
							 log.action === 'rejected' ? '❌' :
							 log.action === 'submitted' ? '📩' :
							 log.action === 'suspended' ? '⏸️' : '🔄'}
						</span>
						<div class="flex-1 min-w-0">
							<p class="text-gray-300">
								<span class="text-white font-medium">{log.profiles?.full_name || '-'}</span>
								{' '}{log.action}{' '}
								<span class="text-white">{log.client_accounts?.client_name || '-'}</span>
							</p>
							{#if log.reason}
								<p class="text-gray-500 text-xs mt-0.5">{log.reason}</p>
							{/if}
						</div>
						<span class="text-xs text-gray-600 whitespace-nowrap">{timeAgo(log.created_at)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
