<script lang="ts">
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatDateTime, timeAgo } from '$lib/utils';
	import { goto } from '$app/navigation';

	let { data } = $props();
	let { accounts, statusFilter } = $derived(data);

	let searchInput = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	$effect(() => { searchInput = data.search || ''; });

	function onSearch(e: Event) {
		const q = (e.target as HTMLInputElement).value;
		searchInput = q;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			updateUrl({ q, status: statusFilter });
		}, 300);
	}

	function setFilter(status: string) {
		updateUrl({ q: searchInput, status });
	}

	function updateUrl({ q, status }: { q: string; status: string }) {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		params.set('status', status);
		goto(`/admin/clients?${params}`, { replaceState: true });
	}
</script>

<svelte:head>
	<title>รายการลูกค้า - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold">รายการลูกค้า</h1>
		<span class="text-sm text-gray-400">{accounts.length} รายการ</span>
	</div>

	<!-- Search + Filter -->
	<div class="flex flex-col sm:flex-row gap-3">
		<input
			type="search"
			class="input flex-1"
			placeholder="ค้นหาชื่อ, อีเมล, MT5, IB..."
			value={searchInput}
			oninput={onSearch}
		/>
		<div class="flex gap-1.5 shrink-0">
			{#each ['approved', 'pending', 'rejected', 'all'] as tab}
				<button
					class="px-3 py-1.5 text-sm rounded-lg transition-colors
						{statusFilter === tab ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
					onclick={() => setFilter(tab)}
				>
					{tab === 'approved' ? 'อนุมัติ' :
					 tab === 'pending' ? 'รออนุมัติ' :
					 tab === 'rejected' ? 'ปฏิเสธ' : 'ทั้งหมด'}
				</button>
			{/each}
		</div>
	</div>

	{#if accounts.length === 0}
		<EmptyState message="ไม่พบรายการ" icon="👥" />
	{:else}
		<div class="card overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-400 text-xs">
						<th class="text-left py-2 px-3">ชื่อลูกค้า</th>
						<th class="text-left py-2 px-3">MT5</th>
						<th class="text-left py-2 px-3">IB</th>
						<th class="text-left py-2 px-3">สถานะ</th>
						<th class="text-left py-2 px-3">Sync ล่าสุด</th>
						<th class="text-right py-2 px-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each accounts as account}
						{@const ib = account.master_ibs as { ib_code: string; profiles?: { full_name: string } | null } | null}
						<tr class="border-b border-dark-border/50 hover:bg-dark-hover">
							<td class="py-2.5 px-3">
								<p class="text-white font-medium">{account.client_name}</p>
								{#if account.client_email}
									<p class="text-xs text-gray-400">{account.client_email}</p>
								{/if}
							</td>
							<td class="py-2.5 px-3 text-gray-300">
								<p>{account.mt5_account_id}</p>
								<p class="text-xs text-gray-400">{account.mt5_server}</p>
							</td>
							<td class="py-2.5 px-3 text-gray-300">
								{#if ib}
									<p>{ib.profiles?.full_name || '-'}</p>
									<p class="text-xs text-gray-400">{ib.ib_code}</p>
								{:else}
									<span class="text-gray-500">-</span>
								{/if}
							</td>
							<td class="py-2.5 px-3">
								<StatusBadge status={account.status} />
								{#if account.mt5_validated}
									<span class="text-green-400 text-xs ml-1">MT5 ✓</span>
								{/if}
							</td>
							<td class="py-2.5 px-3 text-gray-400 text-xs">
								{#if account.last_synced_at}
									{timeAgo(account.last_synced_at)}
								{:else}
									-
								{/if}
							</td>
							<td class="py-2.5 px-3 text-right">
								<a href="/admin/clients/{account.id}" class="text-brand-400 hover:text-brand-300 text-xs font-medium">
									ดูรายละเอียด
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
