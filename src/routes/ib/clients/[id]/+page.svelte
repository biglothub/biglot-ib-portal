<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import EquityChart from '$lib/components/charts/EquityChart.svelte';
	import { formatCurrency, formatNumber, formatPercent, formatDateTime, timeAgo } from '$lib/utils';

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
		rejection_reason?: string | null;
		mt5_validation_error?: string | null;
		[key: string]: unknown;
	};
	type LatestStats = { balance: number; equity: number; floating_pl: number; profit: number; win_rate: number; profit_factor: number; max_drawdown: number; total_trades: number };
	type EquityDataItem = { timestamp: string; equity: number; balance?: number; floating_pl?: number };
	type OpenPosition = { symbol: string; type: string; lot_size: number; open_price: number; current_price?: number | null; current_profit?: number | null; [key: string]: unknown };
	type RecentTrade = { id: string; symbol: string; type: string; lot_size: number; open_price: number; close_price: number; profit: number; close_time: string; [key: string]: unknown };

	let { data } = $props();
	let { account, latestStats: rawLatestStats, equityData: rawEquityData, openPositions, recentTrades } = $derived(data);
	const typedAccount = $derived(account as ClientAccount);
	const latestStats = $derived(rawLatestStats as LatestStats | null);
	const typedPositions = $derived((openPositions as OpenPosition[]) || []);
	const typedTrades = $derived((recentTrades as RecentTrade[]) || []);

	const chartSnapshots = $derived(
		((rawEquityData as EquityDataItem[]) || []).map((d: EquityDataItem) => ({
			time: Math.floor(new Date(d.timestamp).getTime() / 1000),
			balance: d.balance || d.equity,
			equity: d.equity,
			floatingPL: d.floating_pl || 0
		}))
	);

	// Resubmit form state
	let mt5AccountId = $state('');
	let mt5Password = $state('');
	let mt5Server = $state('');
	let submitting = $state(false);
	let submitError = $state('');
	let syncedAccountId = $state('');

	// Edit state
	let editing = $state(false);
	let saving = $state(false);
	let editError = $state('');
	let editSuccess = $state('');
	let editName = $state('');
	let editEmail = $state('');
	let editPhone = $state('');
	let editNickname = $state('');

	// Cancel state
	let showCancelConfirm = $state(false);
	let cancelling = $state(false);
	let cancelError = $state('');

	$effect(() => {
		if (!typedAccount?.id || syncedAccountId === typedAccount.id) return;
		syncedAccountId = typedAccount.id;
		mt5AccountId = typedAccount.mt5_account_id || '';
		mt5Password = '';
		mt5Server = typedAccount.mt5_server || '';
	});

	function openEdit() {
		editName = typedAccount.client_name || '';
		editEmail = (typedAccount.client_email as string) || '';
		editPhone = (typedAccount.client_phone as string) || '';
		editNickname = (typedAccount.nickname as string) || '';
		editError = '';
		editSuccess = '';
		editing = true;
	}

	async function handleEdit() {
		saving = true;
		editError = '';

		try {
			const res = await fetch('/api/ib/clients/edit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_account_id: typedAccount.id,
					client_name: editName,
					client_email: editEmail,
					client_phone: editPhone,
					nickname: editNickname
				})
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

	async function handleCancel() {
		cancelling = true;
		cancelError = '';

		try {
			const res = await fetch('/api/ib/clients/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ client_account_id: typedAccount.id })
			});

			if (!res.ok) {
				const err = await res.json();
				cancelError = err.message || 'เกิดข้อผิดพลาด';
				return;
			}

			goto('/ib/clients');
		} catch {
			cancelError = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			cancelling = false;
		}
	}

	async function handleResubmit() {
		submitting = true;
		submitError = '';

		try {
			const res = await fetch('/api/ib/clients/resubmit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_account_id: typedAccount.id,
					mt5_account_id: mt5AccountId,
					mt5_investor_password: mt5Password,
					mt5_server: mt5Server
				})
			});

			if (!res.ok) {
				const err = await res.json();
				submitError = err.message || 'เกิดข้อผิดพลาด';
				return;
			}

			goto('/ib/clients');
		} catch {
			submitError = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			submitting = false;
		}
	}

	const canEdit = $derived(typedAccount.status !== 'suspended');
	const canCancel = $derived(typedAccount.status === 'pending' || typedAccount.status === 'rejected');
</script>

<svelte:head>
	<title>{typedAccount.client_name} - พอร์ตโฟลิโอ</title>
</svelte:head>

<div class="space-y-6">
	<a href="/ib/clients" class="text-sm text-gray-500 hover:text-brand-400">&larr; กลับ</a>

	<!-- Header -->
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
					{#if typedAccount.last_synced_at}
						 | Sync: {timeAgo(typedAccount.last_synced_at as string)}
					{/if}
				</p>
			</div>
		</div>
		<div class="flex gap-2">
			{#if canEdit}
				<button class="btn-secondary text-sm" onclick={openEdit}>
					แก้ไข
				</button>
			{/if}
			{#if canCancel}
				<button class="btn-danger text-sm" onclick={() => { showCancelConfirm = true; cancelError = ''; }}>
					ยกเลิก
				</button>
			{/if}
		</div>
	</div>

	{#if editSuccess}
		<div class="bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-3 rounded-lg">
			{editSuccess}
		</div>
	{/if}

	{#if typedAccount.status === 'rejected'}
		<!-- Rejection Info -->
		<div class="card border-red-500/30">
			<h2 class="text-sm font-medium text-red-400 mb-3">บัญชีถูกปฏิเสธ</h2>
			{#if typedAccount.rejection_reason}
				<div class="bg-red-500/10 rounded-lg p-3 mb-3">
					<p class="text-sm text-gray-300"><span class="text-red-400 font-medium">เหตุผล:</span> {typedAccount.rejection_reason as string}</p>
				</div>
			{/if}
			{#if typedAccount.mt5_validation_error}
				<div class="bg-yellow-500/10 rounded-lg p-3 mb-3">
					<p class="text-sm text-gray-300"><span class="text-yellow-400 font-medium">MT5 Error:</span> {typedAccount.mt5_validation_error as string}</p>
				</div>
			{/if}
		</div>

		<!-- Resubmit Form -->
		<div class="card">
			<h2 class="text-sm font-medium text-gray-400 mb-4">แก้ไข MT5 และส่งใหม่</h2>
			<form onsubmit={(e) => { e.preventDefault(); handleResubmit(); }} class="space-y-4">
				<div>
					<label class="label" for="mt5_account_id">MT5 Account ID</label>
					<input
						id="mt5_account_id"
						type="text"
						class="input"
						bind:value={mt5AccountId}
						required
					/>
				</div>
				<div>
					<label class="label" for="mt5_password">Investor Password</label>
					<input
						id="mt5_password"
						type="password"
						class="input"
						bind:value={mt5Password}
						placeholder="กรอกรหัสผ่านใหม่"
						required
					/>
				</div>
				<div>
					<label class="label" for="mt5_server">MT5 Server</label>
					<select id="mt5_server" class="input" bind:value={mt5Server} required>
						<option value="" disabled>เลือก MT5 Server</option>
						<option value="Connext-Real">Connext-Real</option>
						<option value="Connext-Demo">Connext-Demo</option>
					</select>
				</div>

				{#if submitError}
					<p class="text-sm text-red-400">{submitError}</p>
				{/if}

				<button type="submit" class="btn-primary" disabled={submitting || !mt5Password}>
					{submitting ? 'กำลังส่ง...' : 'ส่งตรวจสอบใหม่'}
				</button>
			</form>
		</div>
	{:else}
		{#if latestStats}
			<!-- KPI Cards -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard label="ยอดเงิน" value={formatCurrency(latestStats.balance)} color="text-white" />
				<MetricCard label="มูลค่าพอร์ต" value={formatCurrency(latestStats.equity)} color="text-white" />
				<MetricCard
					label="กำไร/ขาดทุนลอย"
					value={formatCurrency(latestStats.floating_pl)}
					color={latestStats.floating_pl >= 0 ? 'text-green-400' : 'text-red-400'}
				/>
				<MetricCard
					label="กำไร"
					value={formatCurrency(latestStats.profit)}
					color={latestStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}
				/>
			</div>

			<!-- Performance Stats -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard label="อัตราชนะ" value={formatPercent(latestStats.win_rate).replace('+', '')} />
				<MetricCard label="อัตราส่วนกำไร" value={formatNumber(latestStats.profit_factor)} />
				<MetricCard label="ขาดทุนสูงสุด" value={formatPercent(latestStats.max_drawdown)} color="text-red-400" />
				<MetricCard label="เทรดทั้งหมด" value={String(latestStats.total_trades || 0)} />
			</div>
		{:else}
			<div class="card text-center py-8">
				<p class="text-gray-500">ยังไม่มีข้อมูล - รอ Bridge sync</p>
			</div>
		{/if}

		<!-- Equity Curve -->
		{#if chartSnapshots.length > 1}
			<div class="card">
				<EquityChart equitySnapshots={chartSnapshots} />
			</div>
		{/if}

		<!-- Open Positions -->
		<div class="card">
			<h2 class="text-sm font-medium text-gray-400 mb-4">
				ตำแหน่งที่เปิด ({typedPositions.length})
			</h2>
			{#if typedPositions.length === 0}
				<EmptyState message="ไม่มี position เปิดอยู่" icon="📭" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">สัญลักษณ์</th>
								<th class="text-left py-2">ประเภท</th>
								<th class="text-right py-2">ล็อต</th>
								<th class="text-right py-2">ราคาเปิด</th>
								<th class="text-right py-2">ปัจจุบัน</th>
								<th class="text-right py-2">กำไร/ขาดทุน</th>
							</tr>
						</thead>
						<tbody>
							{#each typedPositions as pos}
								<tr class="border-b border-dark-border/50">
									<td class="py-2 text-white font-medium">{pos.symbol}</td>
									<td class="py-2">
										<span class="text-xs px-1.5 py-0.5 rounded {pos.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
											{pos.type}
										</span>
									</td>
									<td class="py-2 text-right text-gray-300">{pos.lot_size}</td>
									<td class="py-2 text-right text-gray-300">{formatNumber(pos.open_price, 5)}</td>
									<td class="py-2 text-right text-gray-300">{pos.current_price ? formatNumber(pos.current_price, 5) : '-'}</td>
									<td class="py-2 text-right font-medium {(pos.current_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}">
										{pos.current_profit != null ? formatCurrency(pos.current_profit) : '-'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Recent Trades -->
		<div class="card">
			<h2 class="text-sm font-medium text-gray-400 mb-4">
				เทรดล่าสุด ({typedTrades.length})
			</h2>
			{#if typedTrades.length === 0}
				<EmptyState message="ยังไม่มี trade" icon="📊" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">สัญลักษณ์</th>
								<th class="text-left py-2">ประเภท</th>
								<th class="text-right py-2">ล็อต</th>
								<th class="text-right py-2">เปิด</th>
								<th class="text-right py-2">ปิด</th>
								<th class="text-right py-2">กำไร/ขาดทุน</th>
								<th class="text-right py-2">เวลา</th>
							</tr>
						</thead>
						<tbody>
							{#each typedTrades as trade}
								<tr class="border-b border-dark-border/50">
									<td class="py-2 text-white">{trade.symbol}</td>
									<td class="py-2">
										<span class="text-xs px-1.5 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
											{trade.type}
										</span>
									</td>
									<td class="py-2 text-right text-gray-300">{trade.lot_size}</td>
									<td class="py-2 text-right text-gray-300">{formatNumber(trade.open_price, 5)}</td>
									<td class="py-2 text-right text-gray-300">{formatNumber(trade.close_price, 5)}</td>
									<td class="py-2 text-right font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(trade.profit)}
									</td>
									<td class="py-2 text-right text-gray-500 text-xs">{formatDateTime(trade.close_time)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Edit Modal -->
{#if editing}
	<div transition:fade={{ duration: 200 }} class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
		<div transition:fly={{ y: 30, duration: 250 }} class="card max-w-lg w-full">
			<h3 class="text-lg font-medium mb-4">แก้ไขข้อมูลลูกค้า</h3>
			<form onsubmit={(e) => { e.preventDefault(); handleEdit(); }} class="space-y-4">
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

<!-- Cancel Confirm Modal -->
{#if showCancelConfirm}
	<div transition:fade={{ duration: 200 }} class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
		<div transition:fly={{ y: 30, duration: 250 }} class="card max-w-md w-full">
			<h3 class="text-lg font-medium mb-2">ยืนยันการยกเลิก</h3>
			<p class="text-sm text-gray-400 mb-4">
				ต้องการยกเลิกลูกค้า <span class="text-white font-medium">{typedAccount.client_name}</span> หรือไม่?
				ข้อมูลจะถูกลบออกจากระบบ
			</p>

			{#if cancelError}
				<p class="text-sm text-red-400 mb-4">{cancelError}</p>
			{/if}

			<div class="flex gap-2 justify-end">
				<button class="btn-secondary text-sm" onclick={() => showCancelConfirm = false}>ไม่ยกเลิก</button>
				<button
					class="btn-danger text-sm"
					disabled={cancelling}
					onclick={handleCancel}
				>
					{cancelling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
				</button>
			</div>
		</div>
	</div>
{/if}
