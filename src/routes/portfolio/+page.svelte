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
	import AiCoachCard from '$lib/components/portfolio/AiCoachCard.svelte';
	import RiskCalculator from '$lib/components/portfolio/RiskCalculator.svelte';
	import { formatCurrency, formatDateTime, formatNumber, formatPercent, formatPnl, timeAgo } from '$lib/utils';
	import { getTradeReviewStatus } from '$lib/portfolio';
	import { displayUnit } from '$lib/stores/displayUnit';
	import { marketNewsStore } from '$lib/stores/newsStore';
	import { invalidate } from '$app/navigation';
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

	// Sync state
	let account = $derived(data.account);
	let bridgeStatus = $derived((data as any).bridgeStatus as string | null);
	let isBridgeRunning = $derived(bridgeStatus === 'running');
	let syncingNow = $state(false);
	let syncError = $state<string | null>(null);
	let syncCooldown = $state(false);
	let syncSuccess = $state(false);

	async function triggerSync() {
		if (syncingNow || syncCooldown || !account) return;
		syncingNow = true;
		syncError = null;
		syncSuccess = false;
		try {
			const res = await fetch('/api/portfolio/sync-trigger', { method: 'POST' });
			if (res.status === 429) {
				syncError = 'กรุณารอ 60 วินาทีก่อน Sync ใหม่';
			} else if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				syncError = body.message || 'เกิดข้อผิดพลาด';
			} else {
				syncSuccess = true;
				syncCooldown = true;
				setTimeout(() => { syncCooldown = false; }, 60_000);
				setTimeout(() => { syncSuccess = false; }, 5_000);
				await invalidate('portfolio:baseData');
			}
		} catch {
			syncError = 'ไม่สามารถเชื่อมต่อได้';
		} finally {
			syncingNow = false;
		}
	}
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

		<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
			<AiCoachCard />
			<RiskCalculator accountBalance={latestStats?.balance || 0} />

			<!-- Sync Status Card -->
			<div class="card">
				<div>
					<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">การเชื่อมต่อ</p>
					<h2 class="mt-1 text-lg font-semibold text-white">สถานะ Sync</h2>
				</div>

				<div class="mt-4 space-y-3">
					<!-- Bridge Status -->
					<div class="flex items-center justify-between rounded-xl border border-dark-border bg-dark-bg/30 px-3 py-3">
						<div class="flex items-center gap-2">
							{#if isBridgeRunning}
								<span class="relative flex h-2.5 w-2.5">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
									<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
								</span>
								<span class="text-sm text-green-400">Bridge ออนไลน์</span>
							{:else if bridgeStatus === 'stopped'}
								<span class="h-2.5 w-2.5 rounded-full bg-red-500"></span>
								<span class="text-sm text-red-400">Bridge ออฟไลน์</span>
							{:else}
								<span class="h-2.5 w-2.5 rounded-full bg-gray-500"></span>
								<span class="text-sm text-gray-400">ไม่ทราบสถานะ</span>
							{/if}
						</div>
						<span class="text-xs text-gray-500">MT5 Bridge</span>
					</div>

					<!-- Last Sync Time -->
					<div class="flex items-center justify-between rounded-xl border border-dark-border bg-dark-bg/30 px-3 py-3">
						<div class="text-sm text-gray-300">ซิงค์ล่าสุด</div>
						<div class="text-sm font-medium text-white">
							{#if account?.last_synced_at}
								{timeAgo(account.last_synced_at)}
							{:else}
								<span class="text-gray-500">ยังไม่เคยซิงค์</span>
							{/if}
						</div>
					</div>

					<!-- Sync Interval -->
					<div class="flex items-center justify-between rounded-xl border border-dark-border bg-dark-bg/30 px-3 py-3">
						<div class="text-sm text-gray-300">รอบอัตโนมัติ</div>
						<div class="text-sm font-medium text-gray-400">ทุก 60 วินาที</div>
					</div>

					<!-- Sync Button -->
					<button
						onclick={triggerSync}
						disabled={syncingNow || syncCooldown || !account}
						class="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all
							{syncingNow
								? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30 cursor-wait'
								: syncCooldown
									? 'bg-dark-bg/50 text-gray-600 border border-dark-border cursor-not-allowed'
									: 'bg-brand-primary text-dark-bg hover:bg-brand-primary/90 active:scale-[0.98]'}"
					>
						{#if syncingNow}
							<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
								<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25" />
								<path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" class="opacity-75" />
							</svg>
							กำลัง Sync...
						{:else if syncCooldown}
							<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z" clip-rule="evenodd"/></svg>
							รอสักครู่ก่อน Sync ใหม่
						{:else}
							<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
							Sync ตอนนี้
						{/if}
					</button>

					<!-- Status Messages -->
					{#if syncSuccess}
						<div class="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-xs text-green-400 text-center">
							ส่งคำสั่ง Sync สำเร็จ — ข้อมูลจะอัปเดตในอีกสักครู่
						</div>
					{/if}
					{#if syncError}
						<div class="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400 text-center">
							{syncError}
						</div>
					{/if}
				</div>
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
	checklistRules={(checklistRules as any) || []}
	checklistCompletions={(checklistCompletions as any) || []}
	checklistDoneToday={checklistDoneToday || false}
	todayJournal={(todayJournal as any) || null}
	marketNews={($marketNewsStore as any) || []}
	{today}
/>
