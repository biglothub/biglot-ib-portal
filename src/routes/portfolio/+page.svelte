<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import EquityChart from '$lib/components/charts/EquityChart.svelte';
	import DailyPnlChart from '$lib/components/charts/DailyPnlChart.svelte';
	import TradingScoreRadar from '$lib/components/charts/TradingScoreRadar.svelte';
	import MiniCalendar from '$lib/components/portfolio/MiniCalendar.svelte';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import { formatCurrency, formatDateTime, formatNumber, formatPercent } from '$lib/utils';
	import { getTradeReviewStatus } from '$lib/portfolio';
	let { data } = $props();
	let {
		latestStats,
		openPositions,
		recentTrades,
		dailyHistory,
		equityCurve,
		equitySnapshots,
		commandCenter,
		filterState,
		filterOptions,
		tags,
		playbooks,
		setupPerformance,
		ruleBreakMetrics,
		journalSummary
	} = $derived(data);
	let safeCommandCenter = $derived(commandCenter || {
		today: { pnl: 0, trades: 0, reviewedTrades: 0, completedJournal: false },
		reviewSummary: { unreviewed: 0 },
		unreviewedTrades: [],
		activePlaybooks: 0
	});
	let safeRuleBreakMetrics = $derived(ruleBreakMetrics || { totalRuleBreaks: 0, ruleBreakLoss: 0, topRules: [] });
	let safeSetupPerformance = $derived(setupPerformance || []);

	// Enhanced metric card calculations
	let totalTrades = $derived(latestStats?.total_trades || 0);
	let winCount = $derived(Math.round((latestStats?.win_rate || 0) * totalTrades / 100));
	let lossCount = $derived(totalTrades - winCount);
</script>

{#if !latestStats && (!commandCenter || !data.account)}
	<div class="card text-center py-12">
		<h2 class="text-lg font-medium text-white mb-2">ยังไม่มีบัญชีที่อนุมัติ</h2>
		<p class="text-sm text-gray-400">กรุณาติดต่อ Master IB ของคุณ</p>
	</div>
{:else}
	<div class="space-y-6">
		<PortfolioFilterBar
			filters={filterState}
			{filterOptions}
			{tags}
			{playbooks}
			pageKey="overview"
		/>

		<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
			<MetricCard
				label="Balance"
				value={formatCurrency(latestStats?.balance || 0)}
				subValue={totalTrades > 0 ? `${totalTrades} trades` : ''}
			/>
			<MetricCard
				label="Equity"
				value={formatCurrency(latestStats?.equity || 0)}
			/>
			<MetricCard
				label="Win Rate"
				value={formatPercent(latestStats?.win_rate || 0).replace('+', '')}
				color={(latestStats?.win_rate || 0) >= 50 ? 'text-green-400' : 'text-amber-400'}
				donutPercent={latestStats?.win_rate || 0}
				tradeCount={totalTrades > 0 ? { wins: winCount, losses: lossCount } : undefined}
			/>
			<MetricCard
				label="Profit Factor"
				value={formatNumber(latestStats?.profit_factor || 0)}
				color={(latestStats?.profit_factor || 0) >= 1 ? 'text-green-400' : 'text-red-400'}
			/>
			<MetricCard
				label="Expectancy"
				value={formatCurrency(totalTrades > 0 ? (latestStats?.balance || 0) / totalTrades : 0)}
				color={(latestStats?.balance || 0) >= 0 ? 'text-green-400' : 'text-red-400'}
			/>
		</div>

		{#if (equitySnapshots && equitySnapshots.length > 1) || (equityCurve && equityCurve.length > 1)}
			<div class="card">
				<EquityChart {equitySnapshots} {equityCurve} />
			</div>
		{/if}

		{#if dailyHistory && dailyHistory.length > 0}
			<div class="card">
				<DailyPnlChart {dailyHistory} />
			</div>
		{/if}

		<div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
			<div class="card xl:col-span-1">
				<TradingScoreRadar
					winRate={latestStats?.win_rate || 0}
					profitFactor={latestStats?.profit_factor || 0}
					avgWin={latestStats?.avg_win || 0}
					avgLoss={latestStats?.avg_loss || 0}
				/>
			</div>
			<div class="card xl:col-span-1 space-y-4">
				<div>
					<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">Today</p>
					<h2 class="mt-1 text-lg font-semibold text-white">What needs attention</h2>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">Day P/L</div>
						<div class="mt-1 text-lg font-semibold {safeCommandCenter.today.pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
							{formatCurrency(safeCommandCenter.today.pnl || 0)}
						</div>
					</div>
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">Trades</div>
						<div class="mt-1 text-lg font-semibold text-white">{safeCommandCenter.today.trades || 0}</div>
					</div>
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">Reviewed</div>
						<div class="mt-1 text-lg font-semibold text-white">{safeCommandCenter.today.reviewedTrades || 0}</div>
					</div>
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">Journal</div>
						<div class="mt-1 text-lg font-semibold {safeCommandCenter.today.completedJournal ? 'text-green-400' : 'text-amber-300'}">
							{safeCommandCenter.today.completedJournal ? 'Complete' : 'Pending'}
						</div>
					</div>
				</div>
				<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-4 text-sm text-gray-300">
					<div class="flex items-center justify-between">
						<span>Review queue</span>
						<span class="font-semibold text-white">{safeCommandCenter.reviewSummary.unreviewed || 0} open</span>
					</div>
					<div class="mt-2 flex items-center justify-between">
						<span>Journal completion</span>
						<span class="font-semibold text-white">{(journalSummary?.completionRate || 0).toFixed(0)}%</span>
					</div>
					<div class="mt-2 flex items-center justify-between">
						<span>Active playbooks</span>
						<span class="font-semibold text-white">{safeCommandCenter.activePlaybooks || 0}</span>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3 text-sm">
					<a href="/portfolio/trades" class="rounded-xl border border-dark-border px-3 py-3 text-center text-gray-300 hover:text-white hover:border-brand-primary/40">
						Open review inbox
					</a>
					<a href="/portfolio/journal" class="rounded-xl border border-dark-border px-3 py-3 text-center text-gray-300 hover:text-white hover:border-brand-primary/40">
						Open notebook
					</a>
				</div>
			</div>

			<div class="card xl:col-span-1">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">Review Pipeline</p>
						<h2 class="mt-1 text-lg font-semibold text-white">Unreviewed trades</h2>
					</div>
					<a href="/portfolio/trades" class="text-xs text-brand-primary">ดูทั้งหมด</a>
				</div>
				<div class="mt-4 space-y-2">
					{#if safeCommandCenter.unreviewedTrades.length > 0}
						{#each safeCommandCenter.unreviewedTrades as trade}
							<a href={`/portfolio/trades/${trade.id}`} class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3 hover:bg-dark-bg/50">
								<div>
									<div class="flex items-center gap-2">
										<span class="text-sm font-semibold text-white">{trade.symbol}</span>
										<span class="text-[10px] text-gray-500">{trade.type}</span>
									</div>
									<div class="mt-1 text-[11px] text-gray-500">{formatDateTime(trade.close_time)}</div>
								</div>
								<div class="text-right">
									<ReviewStatusBadge status={getTradeReviewStatus(trade)} />
									<div class="mt-1 text-sm font-semibold {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(trade.profit)}
									</div>
								</div>
							</a>
						{/each}
					{:else}
						<EmptyState message="ไม่มี trade ที่ค้างรีวิวใน filter ชุดนี้" />
					{/if}
				</div>
			</div>

			<div class="card xl:col-span-1">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">Rule Breaks</p>
						<h2 class="mt-1 text-lg font-semibold text-white">Cost of mistakes</h2>
					</div>
					<a href="/portfolio/analytics" class="text-xs text-brand-primary">เปิด report</a>
				</div>
				<div class="mt-4 grid grid-cols-2 gap-3">
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">Broken rules</div>
						<div class="mt-1 text-2xl font-semibold text-white">{safeRuleBreakMetrics.totalRuleBreaks || 0}</div>
					</div>
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">Loss from breaks</div>
						<div class="mt-1 text-2xl font-semibold text-red-400">{formatCurrency(safeRuleBreakMetrics.ruleBreakLoss || 0)}</div>
					</div>
				</div>
				<div class="mt-4 space-y-2">
					{#if safeRuleBreakMetrics.topRules.length > 0}
						{#each safeRuleBreakMetrics.topRules as rule}
							<div class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-2 text-sm">
								<div class="text-gray-300">{rule.rule}</div>
								<div class="text-right">
									<div class="text-white">{rule.count}x</div>
									<div class="text-[11px] text-red-300">{formatCurrency(rule.loss)}</div>
								</div>
							</div>
						{/each}
					{:else}
						<div class="rounded-xl border border-dashed border-dark-border px-3 py-4 text-center text-sm text-gray-500">
							No rule breaks captured yet.
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
			<div class="card">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">Setup Performance</p>
						<h2 class="mt-1 text-lg font-semibold text-white">What is working</h2>
					</div>
					<a href="/portfolio/playbook" class="text-xs text-brand-primary">manage playbooks</a>
				</div>
				<div class="mt-4 space-y-2">
					{#if safeSetupPerformance.length > 0}
						{#each safeSetupPerformance.slice(0, 5) as setup}
							<div class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3 text-sm">
								<div>
									<div class="font-medium text-white">{setup.name}</div>
									<div class="text-[11px] text-gray-500">{setup.totalTrades} trades • {setup.winRate.toFixed(0)}% win</div>
								</div>
								<div class="text-right">
									<div class="font-semibold {setup.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(setup.totalProfit)}
									</div>
									<div class="text-[11px] text-gray-500">Exp {formatCurrency(setup.expectancy)}</div>
								</div>
							</div>
						{/each}
					{:else}
						<EmptyState message="ยังไม่มี data ของ setup / playbook" />
					{/if}
				</div>
			</div>

			<div class="card">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">Live Exposure</p>
						<h2 class="mt-1 text-lg font-semibold text-white">Open positions</h2>
					</div>
					<span class="text-xs text-gray-500">{openPositions.length} open</span>
				</div>
				{#if openPositions.length === 0}
					<div class="mt-4">
						<EmptyState message="ไม่มี position เปิดอยู่" />
					</div>
				{:else}
					<div class="mt-4 space-y-2">
						{#each openPositions as position}
							<div class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3 text-sm">
								<div>
									<div class="font-medium text-white">{position.symbol}</div>
									<div class="text-[11px] text-gray-500">{position.type} • {position.lot_size} lots</div>
								</div>
								<div class="text-right">
									<div class="font-semibold {position.current_profit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(position.current_profit)}
									</div>
									<div class="text-[11px] text-gray-500">{formatNumber(position.current_price, 5)}</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="card">
				<div>
					<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">Trading Calendar</p>
					<h2 class="mt-1 text-lg font-semibold text-white mb-3">Monthly activity</h2>
				</div>
				<MiniCalendar {dailyHistory} />
			</div>
		</div>

		<div class="card">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">Latest Closures</p>
					<h2 class="mt-1 text-lg font-semibold text-white">Recent trades in current filter</h2>
				</div>
				<a href="/portfolio/trades" class="text-xs text-brand-primary">Open inbox</a>
			</div>
			{#if recentTrades.length === 0}
				<div class="mt-4">
					<EmptyState message="ไม่พบ trade ตาม filter ที่เลือก" />
				</div>
			{:else}
				<div class="mt-4 overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left py-2">Symbol</th>
								<th class="text-left py-2">Review</th>
								<th class="text-right py-2">P/L</th>
								<th class="text-right py-2">Time</th>
							</tr>
						</thead>
						<tbody>
							{#each recentTrades as trade}
								<tr class="border-b border-dark-border/40">
									<td class="py-3">
										<a href={`/portfolio/trades/${trade.id}`} class="font-medium text-white hover:text-brand-primary">
											{trade.symbol}
										</a>
									</td>
									<td class="py-3"><ReviewStatusBadge status={getTradeReviewStatus(trade)} /></td>
									<td class="py-3 text-right font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(trade.profit)}
									</td>
									<td class="py-3 text-right text-gray-500">{formatDateTime(trade.close_time)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

	</div>
{/if}
