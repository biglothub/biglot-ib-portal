<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber, formatPercent, formatDateTime, timeAgo } from '$lib/utils';
	import { fade, fly } from 'svelte/transition';
	import { goto, invalidateAll } from '$app/navigation';

	type ClientAccount = {
		id: string;
		client_name: string;
		client_email?: string;
		client_phone?: string;
		nickname?: string;
		mt5_account_id: string;
		mt5_server: string;
		status: string;
		last_synced_at?: string | null;
		master_ibs?: { ib_code: string; profiles?: { full_name: string } | null } | null;
		[key: string]: unknown;
	};
	type LatestStats = { balance: number; equity: number; floating_pl: number; profit: number; win_rate: number; profit_factor: number; max_drawdown: number; total_trades: number };
	type OpenPosition = { symbol: string; type: string; lot_size: number; open_price: number; current_profit?: number | null; [key: string]: unknown };
	type RecentTrade = { id: string; symbol: string; type: string; lot_size: number; profit: number; close_time: string; [key: string]: unknown };

	let { data } = $props();
	let { account, latestStats: rawLatestStats, openPositions, recentTrades } = $derived(data);
	const typedAccount = $derived(account as ClientAccount);
	const latestStats = $derived(rawLatestStats as LatestStats | null);
	const typedPositions = $derived((openPositions as OpenPosition[]) || []);
	const typedTrades = $derived((recentTrades as RecentTrade[]) || []);

	// Edit state
	let editing = $state(false);
	let saving = $state(false);
	let editError = $state('');
	let editSuccess = $state('');
	let editName = $state('');
	let editEmail = $state('');
	let editPhone = $state('');
	let editNickname = $state('');
	let editMt5AccountId = $state('');
	let editMt5Server = $state('');
	let editMt5Password = $state('');

	// Delete state
	let showDeleteConfirm = $state(false);
	let deleting = $state(false);
	let deleteError = $state('');
	let deleteReason = $state('');

	function openEdit() {
		editName = typedAccount.client_name || '';
		editEmail = (typedAccount.client_email as string) || '';
		editPhone = (typedAccount.client_phone as string) || '';
		editNickname = (typedAccount.nickname as string) || '';
		editMt5AccountId = typedAccount.mt5_account_id || '';
		editMt5Server = typedAccount.mt5_server || '';
		editMt5Password = '';
		editError = '';
		editSuccess = '';
		editing = true;
	}

	async function handleSave() {
		saving = true;
		editError = '';
		editSuccess = '';

		try {
			const payload: Record<string, string> = {
				client_account_id: typedAccount.id,
				client_name: editName,
				client_email: editEmail,
				client_phone: editPhone,
				nickname: editNickname,
				mt5_account_id: editMt5AccountId,
				mt5_server: editMt5Server
			};
			if (editMt5Password) {
				payload.mt5_investor_password = editMt5Password;
			}

			const res = await fetch('/api/admin/clients/edit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) {
				const err = await res.json();
				editError = err.message || 'เกิดข้อผิดพลาด';
				return;
			}

			editSuccess = 'บันทึกสำเร็จ';
			editing = false;
			await invalidateAll();
		} catch {
			editError = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		deleting = true;
		deleteError = '';

		try {
			const res = await fetch('/api/admin/clients/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_account_id: typedAccount.id,
					reason: deleteReason
				})
			});

			if (!res.ok) {
				const err = await res.json();
				deleteError = err.message || 'เกิดข้อผิดพลาด';
				return;
			}

			goto('/admin/approvals');
		} catch {
			deleteError = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{typedAccount.client_name} - ผู้ดูแลระบบ</title>
</svelte:head>

<div class="space-y-6">
	<a href="/admin/approvals" class="text-sm text-gray-500 hover:text-brand-400">&larr; กลับ</a>

	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<div class="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-lg font-medium">
				{typedAccount.client_name.charAt(0)}
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-lg font-bold">{typedAccount.client_name}</h1>
					<StatusBadge status={typedAccount.status} />
				</div>
				<p class="text-xs text-gray-500">
					MT5: {typedAccount.mt5_account_id} @ {typedAccount.mt5_server}
					| IB: {typedAccount.master_ibs?.profiles?.full_name} ({typedAccount.master_ibs?.ib_code})
					{#if typedAccount.last_synced_at}
						| Sync: {timeAgo(typedAccount.last_synced_at as string)}
					{/if}
				</p>
			</div>
		</div>
		<div class="flex gap-2">
			<a href="/portfolio?account_id={typedAccount.id}" class="btn-primary text-sm flex items-center gap-1.5">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
				</svg>
				ดูพอร์ตละเอียด
			</a>
			<button class="btn-secondary text-sm" onclick={openEdit}>
				แก้ไขข้อมูล
			</button>
			<button class="btn-danger text-sm" onclick={() => { showDeleteConfirm = true; deleteError = ''; deleteReason = ''; }}>
				ลบลูกค้า
			</button>
		</div>
	</div>

	{#if editSuccess}
		<div class="bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-3 rounded-lg">
			{editSuccess}
		</div>
	{/if}

	{#if latestStats}
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<MetricCard label="ยอดเงิน" value={formatCurrency(latestStats.balance)} />
			<MetricCard label="มูลค่าพอร์ต" value={formatCurrency(latestStats.equity)} />
			<MetricCard label="กำไร/ขาดทุนลอย" value={formatCurrency(latestStats.floating_pl)}
				color={latestStats.floating_pl >= 0 ? 'text-green-400' : 'text-red-400'} />
			<MetricCard label="กำไร" value={formatCurrency(latestStats.profit)}
				color={latestStats.profit >= 0 ? 'text-green-400' : 'text-red-400'} />
		</div>
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<MetricCard label="อัตราชนะ" value={formatPercent(latestStats.win_rate).replace('+', '')} />
			<MetricCard label="อัตราส่วนกำไร" value={formatNumber(latestStats.profit_factor)} />
			<MetricCard label="ขาดทุนสูงสุด" value={formatPercent(latestStats.max_drawdown)} color="text-red-400" />
			<MetricCard label="เทรดทั้งหมด" value={String(latestStats.total_trades || 0)} />
		</div>
	{:else}
		<EmptyState message="ยังไม่มีข้อมูลสถิติ" icon="📊" />
	{/if}

	<div class="card">
		<h2 class="text-sm font-medium text-gray-400 mb-4">ตำแหน่งที่เปิด ({typedPositions.length})</h2>
		{#if typedPositions.length === 0}
			<EmptyState message="ไม่มี position เปิด" />
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-dark-border text-gray-500 text-xs">
							<th class="text-left py-2">สัญลักษณ์</th>
							<th class="text-left py-2">ประเภท</th>
							<th class="text-right py-2">ล็อต</th>
							<th class="text-right py-2">ราคาเปิด</th>
							<th class="text-right py-2">กำไร/ขาดทุน</th>
						</tr>
					</thead>
					<tbody>
						{#each typedPositions as pos}
							<tr class="border-b border-dark-border/50">
								<td class="py-2 text-white">{pos.symbol}</td>
								<td class="py-2"><span class="text-xs px-1.5 py-0.5 rounded {pos.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">{pos.type}</span></td>
								<td class="py-2 text-right text-gray-300">{pos.lot_size}</td>
								<td class="py-2 text-right text-gray-300">{formatNumber(pos.open_price, 5)}</td>
								<td class="py-2 text-right font-medium {(pos.current_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}">{pos.current_profit != null ? formatCurrency(pos.current_profit) : '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<div class="card">
		<h2 class="text-sm font-medium text-gray-400 mb-4">เทรดล่าสุด ({typedTrades.length})</h2>
		{#if typedTrades.length === 0}
			<EmptyState message="ยังไม่มี trade" />
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-dark-border text-gray-500 text-xs">
							<th class="text-left py-2">สัญลักษณ์</th>
							<th class="text-left py-2">ประเภท</th>
							<th class="text-right py-2">ล็อต</th>
							<th class="text-right py-2">กำไร/ขาดทุน</th>
							<th class="text-right py-2">เวลา</th>
						</tr>
					</thead>
					<tbody>
						{#each typedTrades as trade}
							<tr class="border-b border-dark-border/50">
								<td class="py-2 text-white">{trade.symbol}</td>
								<td class="py-2"><span class="text-xs px-1.5 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">{trade.type}</span></td>
								<td class="py-2 text-right text-gray-300">{trade.lot_size}</td>
								<td class="py-2 text-right font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(trade.profit)}</td>
								<td class="py-2 text-right text-gray-500 text-xs">{formatDateTime(trade.close_time)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Delete Confirm Modal -->
{#if showDeleteConfirm}
	<div transition:fade={{ duration: 200 }} class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
		<div transition:fly={{ y: 30, duration: 250 }} class="card max-w-md w-full">
			<h3 class="text-lg font-medium text-red-400 mb-2">ยืนยันการลบลูกค้า</h3>
			<p class="text-sm text-gray-400 mb-4">
				ต้องการลบ <span class="text-white font-medium">{typedAccount.client_name}</span> (MT5: {typedAccount.mt5_account_id}) หรือไม่?
				ข้อมูลทั้งหมดรวมถึง stats, trades, positions จะถูกลบออกจากระบบ
			</p>
			<div class="mb-4">
				<label for="delete_reason" class="label">เหตุผล (ไม่บังคับ)</label>
				<textarea
					id="delete_reason"
					bind:value={deleteReason}
					class="input"
					rows="2"
					placeholder="ระบุเหตุผลที่ลบ..."
				></textarea>
			</div>

			{#if deleteError}
				<p class="text-sm text-red-400 mb-4">{deleteError}</p>
			{/if}

			<div class="flex gap-2 justify-end">
				<button class="btn-secondary text-sm" onclick={() => showDeleteConfirm = false}>ยกเลิก</button>
				<button
					class="btn-danger text-sm"
					disabled={deleting}
					onclick={handleDelete}
				>
					{deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Modal -->
{#if editing}
	<div transition:fade={{ duration: 200 }} class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
		<div transition:fly={{ y: 30, duration: 250 }} class="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
			<h3 class="text-lg font-medium mb-4">แก้ไขข้อมูลลูกค้า</h3>
			<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="space-y-4">
				<div>
					<label class="label" for="edit_name">ชื่อลูกค้า *</label>
					<input id="edit_name" type="text" class="input" bind:value={editName} required minlength="2" />
				</div>
				<div>
					<label class="label" for="edit_email">อีเมล</label>
					<input id="edit_email" type="email" class="input" bind:value={editEmail} />
				</div>
				<div>
					<label class="label" for="edit_phone">เบอร์โทร</label>
					<input id="edit_phone" type="text" class="input" bind:value={editPhone} />
				</div>
				<div>
					<label class="label" for="edit_nickname">ชื่อเล่น</label>
					<input id="edit_nickname" type="text" class="input" bind:value={editNickname} />
				</div>
				<div>
					<label class="label" for="edit_mt5">MT5 Account ID *</label>
					<input id="edit_mt5" type="text" class="input" bind:value={editMt5AccountId} required pattern="\d+" />
				</div>
				<div>
					<label class="label" for="edit_server">MT5 Server *</label>
					<select id="edit_server" class="input" bind:value={editMt5Server} required>
						<option value="" disabled>เลือก MT5 Server</option>
						<option value="Connext-Real">Connext-Real</option>
						<option value="Connext-Demo">Connext-Demo</option>
					</select>
				</div>
				<div>
					<label class="label" for="edit_password">Investor Password</label>
					<input id="edit_password" type="password" class="input" bind:value={editMt5Password} placeholder="เว้นว่างถ้าไม่ต้องการเปลี่ยน" minlength="4" maxlength="64" />
					<p class="text-xs text-gray-500 mt-1">เว้นว่างถ้าไม่ต้องการเปลี่ยนรหัสผ่าน</p>
				</div>

				{#if editError}
					<p class="text-sm text-red-400">{editError}</p>
				{/if}

				<div class="flex gap-2 justify-end">
					<button type="button" class="btn-secondary text-sm" onclick={() => editing = false}>ยกเลิก</button>
					<button type="submit" class="btn-primary text-sm" disabled={saving}>
						{saving ? 'กำลังบันทึก...' : 'บันทึก'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
