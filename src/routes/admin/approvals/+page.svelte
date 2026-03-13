<script lang="ts">
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatDateTime } from '$lib/utils';
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();
	let { accounts, statusFilter } = $derived(data);

	let processing = $state<string | null>(null);
	let rejectingId = $state<string | null>(null);
	let rejectReason = $state('');
	let actionError = $state('');

	async function readErrorMessage(res: Response) {
		try {
			const payload = await res.json();
			return payload.message || 'เกิดข้อผิดพลาด';
		} catch {
			return 'เกิดข้อผิดพลาด';
		}
	}

	async function handleApprove(accountId: string) {
		processing = accountId;
		actionError = '';
		const res = await fetch('/api/admin/approve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ client_account_id: accountId, action: 'approved' })
		});
		if (res.ok) {
			await invalidateAll();
		} else {
			actionError = await readErrorMessage(res);
		}
		processing = null;
	}

	async function handleReject() {
		if (!rejectingId) return;
		processing = rejectingId;
		actionError = '';
		const res = await fetch('/api/admin/approve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				client_account_id: rejectingId,
				action: 'rejected',
				reason: rejectReason
			})
		});
		if (res.ok) {
			rejectingId = null;
			rejectReason = '';
			await invalidateAll();
		} else {
			actionError = await readErrorMessage(res);
		}
		processing = null;
	}

	function setFilter(status: string) {
		actionError = '';
		goto(`/admin/approvals?status=${status}`, { replaceState: true });
	}
</script>

<svelte:head>
	<title>อนุมัติลูกค้า - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-xl font-bold">อนุมัติลูกค้า</h1>

	{#if actionError}
		<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
			{actionError}
		</div>
	{/if}

	<!-- Filter tabs -->
	<div class="flex gap-2">
		{#each ['pending', 'approved', 'rejected', 'all'] as tab}
			<button
				class="px-3 py-1.5 text-sm rounded-lg transition-colors
					{statusFilter === tab ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
				onclick={() => setFilter(tab)}
			>
				{tab === 'pending' ? 'รออนุมัติ' :
				 tab === 'approved' ? 'อนุมัติแล้ว' :
				 tab === 'rejected' ? 'ปฏิเสธ' : 'ทั้งหมด'}
			</button>
		{/each}
	</div>

	<!-- Accounts list -->
	{#if accounts.length === 0}
		<EmptyState message="ไม่มีรายการ" icon="📋" />
	{:else}
		<div class="space-y-3">
			{#each accounts as account}
				<div class="card">
					<div class="flex flex-col md:flex-row md:items-center gap-4">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 mb-1">
								<h3 class="text-sm font-medium text-white">{account.client_name}</h3>
								<StatusBadge status={account.status} />
								{#if account.mt5_validated}
									<span class="text-green-400 text-xs" title="MT5 Validated">MT5 ✓</span>
								{:else if account.mt5_validation_error}
									<span class="text-red-400 text-xs" title={account.mt5_validation_error}>MT5 ✗</span>
								{:else}
									<span class="text-gray-500 text-xs">MT5 รอตรวจ</span>
								{/if}
							</div>
							<div class="text-xs text-gray-500 space-y-0.5">
								<p>MT5: {account.mt5_account_id} @ {account.mt5_server}</p>
								<p>IB: {account.master_ibs?.profiles?.full_name || '-'} ({account.master_ibs?.ib_code || '-'})</p>
								<p>ส่งเมื่อ: {formatDateTime(account.submitted_at)}</p>
								{#if account.client_email}
									<p>Email: {account.client_email}</p>
								{/if}
							</div>
						</div>

						{#if account.status === 'pending'}
							<div class="flex gap-2 shrink-0">
								<button
									class="btn-success text-sm"
									disabled={processing === account.id}
									onclick={() => handleApprove(account.id)}
								>
									{processing === account.id ? '...' : 'อนุมัติ'}
								</button>
								<button
									class="btn-danger text-sm"
									onclick={() => { rejectingId = account.id; rejectReason = ''; }}
								>
									ปฏิเสธ
								</button>
							</div>
						{/if}

						{#if account.status === 'approved'}
							<a href="/admin/clients/{account.id}" class="btn-secondary text-sm shrink-0">
								ดูพอร์ต
							</a>
						{/if}
					</div>

					{#if account.rejection_reason}
						<p class="text-xs text-red-400 mt-2">เหตุผล: {account.rejection_reason}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Reject Modal -->
{#if rejectingId}
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
		<div class="card max-w-md w-full">
			<h3 class="text-lg font-medium mb-4">ปฏิเสธลูกค้า</h3>
			<div class="mb-4">
				<label for="reason" class="label">เหตุผล (ไม่บังคับ)</label>
				<textarea
					id="reason"
					bind:value={rejectReason}
					class="input"
					rows="3"
					placeholder="ระบุเหตุผลที่ปฏิเสธ..."
				></textarea>
			</div>
			<div class="flex gap-2 justify-end">
				<button class="btn-secondary text-sm" onclick={() => rejectingId = null}>ยกเลิก</button>
				<button
					class="btn-danger text-sm"
					disabled={processing !== null}
					onclick={handleReject}
				>
					{processing ? '...' : 'ยืนยันปฏิเสธ'}
				</button>
			</div>
		</div>
	</div>
{/if}
