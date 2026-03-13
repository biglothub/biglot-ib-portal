<script lang="ts">
	import { goto } from '$app/navigation';
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import EquityChart from '$lib/components/charts/EquityChart.svelte';
	import { formatCurrency, formatNumber, formatPercent, formatDateTime, timeAgo } from '$lib/utils';

	let { data } = $props();
	let { account, latestStats, equityData, openPositions, recentTrades } = $derived(data);

	const chartSnapshots = $derived(
		(equityData || []).map((d: any) => ({
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

	$effect(() => {
		if (!account?.id || syncedAccountId === account.id) return;
		syncedAccountId = account.id;
		mt5AccountId = account.mt5_account_id || '';
		mt5Password = '';
		mt5Server = account.mt5_server || '';
	});

	async function handleResubmit() {
		submitting = true;
		submitError = '';

		try {
			const res = await fetch('/api/ib/clients/resubmit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_account_id: account.id,
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
</script>

<svelte:head>
	<title>{account.client_name} - Portfolio</title>
</svelte:head>

<div class="space-y-6">
	<a href="/ib/clients" class="text-sm text-gray-500 hover:text-brand-400">&larr; กลับ</a>

	<!-- Header -->
	<div class="flex items-center gap-4">
		<div class="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-lg font-medium">
			{account.client_name.charAt(0)}
		</div>
		<div>
			<div class="flex items-center gap-2">
				<h1 class="text-lg font-bold">{account.client_name}</h1>
				<StatusBadge status={account.status} />
			</div>
			<p class="text-xs text-gray-500">
				MT5: {account.mt5_account_id} @ {account.mt5_server}
				{#if account.last_synced_at}
					 | Sync: {timeAgo(account.last_synced_at)}
				{/if}
			</p>
		</div>
	</div>

	{#if account.status === 'rejected'}
		<!-- Rejection Info -->
		<div class="card border-red-500/30">
			<h2 class="text-sm font-medium text-red-400 mb-3">บัญชีถูกปฏิเสธ</h2>
			{#if account.rejection_reason}
				<div class="bg-red-500/10 rounded-lg p-3 mb-3">
					<p class="text-sm text-gray-300"><span class="text-red-400 font-medium">เหตุผล:</span> {account.rejection_reason}</p>
				</div>
			{/if}
			{#if account.mt5_validation_error}
				<div class="bg-yellow-500/10 rounded-lg p-3 mb-3">
					<p class="text-sm text-gray-300"><span class="text-yellow-400 font-medium">MT5 Error:</span> {account.mt5_validation_error}</p>
				</div>
			{/if}
		</div>

		<!-- Resubmit Form -->
		<div class="card">
			<h2 class="text-sm font-medium text-gray-400 mb-4">แก้ไขและส่งใหม่</h2>
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
					<input
						id="mt5_server"
						type="text"
						class="input"
						bind:value={mt5Server}
						required
					/>
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
				<MetricCard label="Balance" value={formatCurrency(latestStats.balance)} color="text-white" />
				<MetricCard label="Equity" value={formatCurrency(latestStats.equity)} color="text-white" />
				<MetricCard
					label="Floating P/L"
					value={formatCurrency(latestStats.floating_pl)}
					color={latestStats.floating_pl >= 0 ? 'text-green-400' : 'text-red-400'}
				/>
				<MetricCard
					label="Profit"
					value={formatCurrency(latestStats.profit)}
					color={latestStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}
				/>
			</div>

			<!-- Performance Stats -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard label="Win Rate" value={formatPercent(latestStats.win_rate).replace('+', '')} />
				<MetricCard label="Profit Factor" value={formatNumber(latestStats.profit_factor)} />
				<MetricCard label="Max Drawdown" value={formatPercent(latestStats.max_drawdown)} color="text-red-400" />
				<MetricCard label="Total Trades" value={String(latestStats.total_trades || 0)} />
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
				Open Positions ({openPositions.length})
			</h2>
			{#if openPositions.length === 0}
				<EmptyState message="ไม่มี position เปิดอยู่" icon="📭" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Symbol</th>
								<th class="text-left py-2">Type</th>
								<th class="text-right py-2">Lots</th>
								<th class="text-right py-2">Open Price</th>
								<th class="text-right py-2">Current</th>
								<th class="text-right py-2">P/L</th>
							</tr>
						</thead>
						<tbody>
							{#each openPositions as pos}
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
				Recent Trades ({recentTrades.length})
			</h2>
			{#if recentTrades.length === 0}
				<EmptyState message="ยังไม่มี trade" icon="📊" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Symbol</th>
								<th class="text-left py-2">Type</th>
								<th class="text-right py-2">Lots</th>
								<th class="text-right py-2">Open</th>
								<th class="text-right py-2">Close</th>
								<th class="text-right py-2">P/L</th>
								<th class="text-right py-2">Time</th>
							</tr>
						</thead>
						<tbody>
							{#each recentTrades as trade}
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
