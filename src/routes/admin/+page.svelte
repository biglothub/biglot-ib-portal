<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, timeAgo } from '$lib/utils';

	let { data } = $props();
	let { kpis, recentActivity, bridgeHealth } = $derived(data);

	let bridgeOnline = $derived(
		bridgeHealth?.last_heartbeat
			? (Date.now() - new Date(bridgeHealth.last_heartbeat).getTime()) < 5 * 60 * 1000
			: false
	);
</script>

<svelte:head>
	<title>Admin Dashboard - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-xl font-bold">แดชบอร์ดผู้ดูแล</h1>

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

	<!-- Bridge Health -->
	{#if bridgeHealth}
		<div class="card">
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-sm font-medium text-gray-400">สถานะ Bridge</h2>
				<div class="flex items-center gap-2">
					<span class="w-2 h-2 rounded-full {bridgeOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}"></span>
					<span class="text-xs {bridgeOnline ? 'text-green-400' : 'text-red-400'}">
						{bridgeOnline ? 'ออนไลน์' : 'ออฟไลน์'}
					</span>
				</div>
			</div>
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
				<div>
					<p class="text-gray-400 text-xs">Heartbeat ล่าสุด</p>
					<p class="text-gray-300">{bridgeHealth.last_heartbeat ? timeAgo(bridgeHealth.last_heartbeat) : '-'}</p>
				</div>
				<div>
					<p class="text-gray-400 text-xs">รอบล่าสุด</p>
					<p class="text-gray-300">
						{#if bridgeHealth.accounts_synced != null}
							<span class="text-green-400">{bridgeHealth.accounts_synced}</span> สำเร็จ
							{#if bridgeHealth.accounts_failed > 0}
								, <span class="text-red-400">{bridgeHealth.accounts_failed}</span> ล้มเหลว
							{/if}
						{:else}
							-
						{/if}
					</p>
				</div>
				<div>
					<p class="text-gray-400 text-xs">เวลารอบ</p>
					<p class="text-gray-300">{bridgeHealth.cycle_duration_ms ? (bridgeHealth.cycle_duration_ms / 1000).toFixed(1) + 's' : '-'}</p>
				</div>
				<div>
					<p class="text-gray-400 text-xs">เวอร์ชัน</p>
					<p class="text-gray-300">v{bridgeHealth.version || '-'}</p>
				</div>
			</div>
			{#if bridgeHealth.error_message}
				<p class="text-xs text-red-400/80 mt-2">{bridgeHealth.error_message}</p>
			{/if}
		</div>
	{/if}

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
								<p class="text-gray-400 text-xs mt-0.5">{log.reason}</p>
							{/if}
						</div>
						<span class="text-xs text-gray-400 whitespace-nowrap">{timeAgo(log.created_at)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
