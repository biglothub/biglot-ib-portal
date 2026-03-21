<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import EquityChart from '$lib/components/charts/EquityChart.svelte';
	import DailyPnlChart from '$lib/components/charts/DailyPnlChart.svelte';
	import CumulativePnlChart from '$lib/components/charts/CumulativePnlChart.svelte';
	import TradingScoreRadar from '$lib/components/charts/TradingScoreRadar.svelte';
	import HealthScoreCard from '$lib/components/portfolio/HealthScoreCard.svelte';
	import MiniCalendar from '$lib/components/portfolio/MiniCalendar.svelte';
	import OverviewSkeleton from '$lib/components/portfolio/OverviewSkeleton.svelte';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import StartMyDayModal from '$lib/components/portfolio/StartMyDayModal.svelte';
	import { formatCurrency, formatDateTime, formatNumber, formatPercent, formatPnl } from '$lib/utils';
	import { getTradeReviewStatus } from '$lib/portfolio';
	import { displayUnit } from '$lib/stores/displayUnit';
	import { marketNewsStore } from '$lib/stores/newsStore';
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
		journalSummary,
		kpiMetrics,
		healthScore,
		checklistRules,
		checklistCompletions,
		checklistDoneToday,
		todayJournal,
		today
	} = $derived(data);

	let startMyDayOpen = $state(false);
	let safeCommandCenter = $derived(commandCenter || {
		today: { pnl: 0, trades: 0, reviewedTrades: 0, completedJournal: false },
		reviewSummary: { unreviewed: 0 },
		unreviewedTrades: [],
		activePlaybooks: 0
	});
	let safeRuleBreakMetrics = $derived(ruleBreakMetrics || { totalRuleBreaks: 0, ruleBreakLoss: 0, topRules: [] });
	let safeSetupPerformance = $derived(setupPerformance || []);

	// KPI calculations from server
	let kpi = $derived(kpiMetrics || {
		netPnl: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0, breakEvenTrades: 0,
		tradeWinRate: 0, profitFactor: 0, dayWinRate: 0, profitableDays: 0,
		totalTradingDays: 0, avgWin: 0, avgLoss: 0, avgWinLossRatio: 0, cumulativePnl: []
	});
	let totalTrades = $derived(kpi.totalTrades);
	let winCount = $derived(kpi.winningTrades);
	let lossCount = $derived(kpi.losingTrades);
</script>

{#if !data.account}
	<div class="card text-center py-12">
		<h2 class="text-lg font-medium text-white mb-2">ยังไม่มีบัญชีที่อนุมัติ</h2>
		<p class="text-sm text-gray-400">กรุณาติดต่อ Master IB ของคุณ</p>
	</div>
{:else if !latestStats && !kpiMetrics}
	<OverviewSkeleton />
{:else}
	<div class="space-y-6">
		<PortfolioFilterBar
			filters={filterState}
			{filterOptions}
			{tags}
			{playbooks}
			pageKey="overview"
		/>

		<!-- Primary KPIs -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<MetricCard
				label="กำไร/ขาดทุนสุทธิ"
				value={formatPnl(kpi.netPnl, $displayUnit, latestStats?.balance)}
				color={kpi.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}
				subValue={totalTrades > 0 ? `${totalTrades} เทรด` : ''}
			/>
			<MetricCard
				label="อัตราชนะ (เทรด)"
				value={formatPercent(kpi.tradeWinRate).replace('+', '')}
				color={kpi.tradeWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}
				donutPercent={kpi.tradeWinRate}
				tradeCount={totalTrades > 0 ? { wins: winCount, losses: lossCount } : undefined}
			/>
			<MetricCard
				label="อัตราส่วนกำไร"
				value={kpi.profitFactor >= 999 ? '∞' : formatNumber(kpi.profitFactor)}
				color={kpi.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}
				donutPercent={Math.min((kpi.profitFactor / 3) * 100, 100)}
			/>
			<MetricCard
				label="อัตราชนะ (วัน)"
				value={formatPercent(kpi.dayWinRate).replace('+', '')}
				color={kpi.dayWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}
				donutPercent={kpi.dayWinRate}
				subValue={kpi.totalTradingDays > 0 ? `${kpi.profitableDays}W / ${kpi.totalTradingDays - kpi.profitableDays}L วัน` : ''}
			/>
		</div>

		<!-- Secondary KPIs -->
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<MetricCard
				label="ยอดเงิน"
				value={formatCurrency(latestStats?.balance || 0)}
			/>
			<MetricCard
				label="มูลค่าพอร์ต"
				value={formatCurrency(latestStats?.equity || 0)}
			/>
			<MetricCard
				label="ค่าเฉลี่ย ชนะ/แพ้"
				value={kpi.avgWinLossRatio >= 999 ? '∞' : formatNumber(kpi.avgWinLossRatio, 2)}
				color={kpi.avgWinLossRatio >= 1 ? 'text-green-400' : 'text-red-400'}
				barData={kpi.avgWin > 0 || kpi.avgLoss > 0 ? {
					left: { value: formatPnl(kpi.avgWin, $displayUnit, latestStats?.balance), color: 'text-green-400' },
					right: { value: formatPnl(-kpi.avgLoss, $displayUnit, latestStats?.balance), color: 'text-red-400' }
				} : undefined}
			/>
			<MetricCard
				label="ค่าคาดหวัง"
				value={formatPnl(totalTrades > 0 ? kpi.netPnl / totalTrades : 0, $displayUnit, latestStats?.balance)}
				color={kpi.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}
			/>
		</div>

		{#if (equitySnapshots && equitySnapshots.length > 1) || (equityCurve && equityCurve.length > 1)}
			<div class="card">
				<EquityChart {equitySnapshots} {equityCurve} />
			</div>
		{/if}

		{#if kpi.cumulativePnl && kpi.cumulativePnl.length > 1}
			<div class="card">
				<CumulativePnlChart data={kpi.cumulativePnl} />
			</div>
		{/if}

		{#if dailyHistory && dailyHistory.length > 0}
			<div class="card">
				<DailyPnlChart {dailyHistory} />
			</div>
		{/if}

		<div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
			<div class="xl:col-span-1 space-y-4">
				<HealthScoreCard score={healthScore?.score || 0} />
				<div class="card">
				<TradingScoreRadar
					winRate={kpi.tradeWinRate}
					profitFactor={kpi.profitFactor >= 999 ? 3 : kpi.profitFactor}
					avgWin={kpi.avgWin}
					avgLoss={kpi.avgLoss}
					recoveryFactor={kpi.recoveryFactor || 0}
					maxDrawdownPct={kpi.maxDrawdownPct || 0}
					consistency={kpi.consistency || 0}
				/>
				</div>
			</div>
			<div class="card xl:col-span-1 space-y-4">
				<div>
					<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">วันนี้</p>
					<h2 class="mt-1 text-lg font-semibold text-white">สิ่งที่ต้องดูแล</h2>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">P/L วันนี้</div>
						<div class="mt-1 text-lg font-semibold {safeCommandCenter.today.pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
							{formatPnl(safeCommandCenter.today.pnl || 0, $displayUnit, latestStats?.balance)}
						</div>
					</div>
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">จำนวนเทรด</div>
						<div class="mt-1 text-lg font-semibold text-white">{safeCommandCenter.today.trades || 0}</div>
					</div>
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">รีวิวแล้ว</div>
						<div class="mt-1 text-lg font-semibold text-white">{safeCommandCenter.today.reviewedTrades || 0}</div>
					</div>
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">บันทึก</div>
						<div class="mt-1 text-lg font-semibold {safeCommandCenter.today.completedJournal ? 'text-green-400' : 'text-amber-300'}">
							{safeCommandCenter.today.completedJournal ? 'เสร็จแล้ว' : 'รอบันทึก'}
						</div>
					</div>
				</div>
				<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-4 text-sm text-gray-300">
					<div class="flex items-center justify-between">
						<span>คิวรีวิว</span>
						<span class="font-semibold text-white">{safeCommandCenter.reviewSummary.unreviewed || 0} รายการ</span>
					</div>
					<div class="mt-2 flex items-center justify-between">
						<span>บันทึก Journal</span>
						<span class="font-semibold text-white">{(journalSummary?.completionRate || 0).toFixed(0)}%</span>
					</div>
					<div class="mt-2 flex items-center justify-between">
						<span>Playbook ที่ใช้งาน</span>
						<span class="font-semibold text-white">{safeCommandCenter.activePlaybooks || 0}</span>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3 text-sm">
					<a href="/portfolio/trades" class="rounded-xl border border-dark-border px-3 py-3 text-center text-gray-300 hover:text-white hover:border-brand-primary/40">
						เปิดคิวรีวิว
					</a>
					<a href="/portfolio/journal" class="rounded-xl border border-dark-border px-3 py-3 text-center text-gray-300 hover:text-white hover:border-brand-primary/40">
						เปิดสมุดบันทึก
					</a>
				</div>
			</div>

			<div class="card xl:col-span-1">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">คิวรีวิว</p>
						<h2 class="mt-1 text-lg font-semibold text-white">เทรดที่ยังไม่ได้รีวิว</h2>
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
						<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">การผิดกฎ</p>
						<h2 class="mt-1 text-lg font-semibold text-white">ต้นทุนความผิดพลาด</h2>
					</div>
					<a href="/portfolio/analytics" class="text-xs text-brand-primary">เปิด report</a>
				</div>
				<div class="mt-4 grid grid-cols-2 gap-3">
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">กฎที่ผิด</div>
						<div class="mt-1 text-2xl font-semibold text-white">{safeRuleBreakMetrics.totalRuleBreaks || 0}</div>
					</div>
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-3">
						<div class="text-xs text-gray-500">ขาดทุนจากการผิดกฎ</div>
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
							ยังไม่มีการผิดกฎที่บันทึกไว้
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
			<div class="card">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">ผลงาน Setup</p>
						<h2 class="mt-1 text-lg font-semibold text-white">อะไรที่ใช้ได้ผล</h2>
					</div>
					<a href="/portfolio/playbook" class="text-xs text-brand-primary">จัดการ playbook</a>
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
						<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">ความเสี่ยงปัจจุบัน</p>
						<h2 class="mt-1 text-lg font-semibold text-white">ออเดอร์ที่เปิดอยู่</h2>
					</div>
					<span class="text-xs text-gray-500">{openPositions.length} รายการ</span>
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
					<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">ปฏิทินเทรด</p>
					<h2 class="mt-1 text-lg font-semibold text-white mb-3">กิจกรรมรายเดือน</h2>
				</div>
				<MiniCalendar {dailyHistory} />
			</div>
		</div>

		<div class="card">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">ปิดล่าสุด</p>
					<h2 class="mt-1 text-lg font-semibold text-white">เทรดล่าสุดตาม filter ที่เลือก</h2>
				</div>
				<a href="/portfolio/trades" class="text-xs text-brand-primary">ดูทั้งหมด</a>
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
								<th class="text-left py-2">สัญลักษณ์</th>
								<th class="text-left py-2">รีวิว</th>
								<th class="text-right py-2">กำไร/ขาดทุน</th>
								<th class="text-right py-2">เวลา</th>
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

	<!-- Start My Day floating button -->
	<button
		onclick={() => startMyDayOpen = true}
		class="fixed bottom-24 right-6 z-50 flex items-center gap-2 rounded-full shadow-lg px-4 py-3 text-sm font-semibold transition-all hover:scale-105 active:scale-95
			{checklistDoneToday
			? 'bg-green-500 text-white shadow-green-500/30'
			: 'bg-brand-primary text-dark-bg shadow-brand-primary/30'}"
		aria-label="เริ่มต้นวันนี้"
	>
		{#if checklistDoneToday}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
			</svg>
		{:else}
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
			</svg>
		{/if}
		<span class="hidden sm:inline">{checklistDoneToday ? 'พร้อมเทรด' : 'เริ่มต้นวันนี้'}</span>
	</button>
{/if}

<StartMyDayModal
	open={startMyDayOpen}
	onclose={() => startMyDayOpen = false}
	checklistRules={checklistRules || []}
	checklistCompletions={checklistCompletions || []}
	checklistDoneToday={checklistDoneToday || false}
	{todayJournal}
	marketNews={$marketNewsStore}
	{today}
/>
