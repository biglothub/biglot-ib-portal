<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import EquityChart from '$lib/components/charts/EquityChart.svelte';
	import { formatCurrency, formatNumber, formatPercent, formatDateTime, timeAgo } from '$lib/utils';

	let { data } = $props();
	const { account, latestStats, equityData, openPositions, recentTrades } = data;

	const chartData = $derived(
		(equityData || []).map((d: any) => ({
			time: Math.floor(new Date(d.timestamp).getTime() / 1000),
			value: d.equity
		}))
	);
</script>

<svelte:head>
	<title>พอร์ตของฉัน - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<h1 class="text-xl font-bold">พอร์ตของฉัน</h1>

	{#if !account}
		<div class="card text-center py-12">
			<span class="text-4xl mb-4 block">📋</span>
			<h2 class="text-lg font-medium text-white mb-2">ยังไม่มีบัญชีที่อนุมัติ</h2>
			<p class="text-sm text-gray-400">กรุณาติดต่อ Master IB ของคุณ</p>
		</div>
	{:else}
		<!-- Account info -->
		<div class="flex items-center gap-3 text-sm text-gray-500">
			<span>MT5: {account.mt5_account_id} @ {account.mt5_server}</span>
			{#if account.last_synced_at}
				<span>| อัพเดท: {timeAgo(account.last_synced_at)}</span>
			{/if}
		</div>

		{#if latestStats}
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard label="Balance" value={formatCurrency(latestStats.balance)} />
				<MetricCard label="Equity" value={formatCurrency(latestStats.equity)} />
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

			<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard label="Win Rate" value={formatPercent(latestStats.win_rate).replace('+', '')} />
				<MetricCard label="Profit Factor" value={formatNumber(latestStats.profit_factor)} />
				<MetricCard label="Max Drawdown" value={formatPercent(latestStats.max_drawdown)} color="text-red-400" />
				<MetricCard label="Total Trades" value={String(latestStats.total_trades || 0)} />
			</div>
		{:else}
			<div class="card text-center py-8">
				<p class="text-gray-500">กำลังรอข้อมูลจาก MT5...</p>
			</div>
		{/if}

		<!-- Equity Curve -->
		{#if chartData.length > 1}
			<div class="card">
				<h2 class="text-sm font-medium text-gray-400 mb-4">Equity Curve (30 วัน)</h2>
				<EquityChart data={chartData} />
			</div>
		{/if}

		<!-- Open Positions -->
		<div class="card">
			<h2 class="text-sm font-medium text-gray-400 mb-4">Positions เปิดอยู่ ({openPositions.length})</h2>
			{#if openPositions.length === 0}
				<EmptyState message="ไม่มี position เปิดอยู่" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Symbol</th>
								<th class="text-left py-2">Type</th>
								<th class="text-right py-2">Lots</th>
								<th class="text-right py-2">Open</th>
								<th class="text-right py-2">Current</th>
								<th class="text-right py-2">P/L</th>
							</tr>
						</thead>
						<tbody>
							{#each openPositions as pos}
								<tr class="border-b border-dark-border/50">
									<td class="py-2 text-white">{pos.symbol}</td>
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
			<h2 class="text-sm font-medium text-gray-400 mb-4">Trades ล่าสุด ({recentTrades.length})</h2>
			{#if recentTrades.length === 0}
				<EmptyState message="ยังไม่มี trade" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Symbol</th>
								<th class="text-left py-2">Type</th>
								<th class="text-right py-2">Lots</th>
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
