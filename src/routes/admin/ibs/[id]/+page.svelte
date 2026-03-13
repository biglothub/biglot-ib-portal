<script lang="ts">
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { formatDateTime } from '$lib/utils';

	let { data } = $props();
	const { ib, clients } = data;
</script>

<svelte:head>
	<title>{ib.profiles?.full_name} - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<a href="/admin/ibs" class="text-sm text-gray-500 hover:text-brand-400">&larr; กลับ</a>

	<!-- IB Profile -->
	<div class="card">
		<div class="flex items-center gap-4">
			<div class="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-lg font-medium">
				{ib.profiles?.full_name?.charAt(0) || '?'}
			</div>
			<div>
				<h1 class="text-lg font-bold">{ib.profiles?.full_name}</h1>
				<p class="text-sm text-gray-500">IB Code: {ib.ib_code} | {ib.profiles?.email}</p>
			</div>
		</div>
	</div>

	<!-- Client List -->
	<div class="card">
		<h2 class="text-sm font-medium text-gray-400 mb-4">ลูกค้า ({clients.length})</h2>

		{#if clients.length === 0}
			<p class="text-sm text-gray-500">ยังไม่มีลูกค้า</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-dark-border text-gray-500 text-xs">
							<th class="text-left py-2 px-2">ชื่อ</th>
							<th class="text-left py-2 px-2">MT5</th>
							<th class="text-left py-2 px-2">สถานะ</th>
							<th class="text-left py-2 px-2">MT5 Valid</th>
							<th class="text-left py-2 px-2">ส่งเมื่อ</th>
							<th class="text-right py-2 px-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each clients as client}
							<tr class="border-b border-dark-border/50 hover:bg-dark-hover">
								<td class="py-2 px-2 text-white">{client.client_name}</td>
								<td class="py-2 px-2 text-gray-400">{client.mt5_account_id}</td>
								<td class="py-2 px-2"><StatusBadge status={client.status} /></td>
								<td class="py-2 px-2">
									{#if client.mt5_validated}
										<span class="text-green-400">✓</span>
									{:else}
										<span class="text-gray-500">-</span>
									{/if}
								</td>
								<td class="py-2 px-2 text-gray-500">{formatDateTime(client.submitted_at)}</td>
								<td class="py-2 px-2 text-right">
									{#if client.status === 'approved'}
										<a href="/admin/clients/{client.id}" class="text-brand-400 hover:text-brand-300 text-xs">ดูพอร์ต</a>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
