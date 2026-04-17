<script lang="ts">
	import MetricCard from '$lib/components/shared/MetricCard.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import DeferRender from '$lib/components/shared/DeferRender.svelte';
	import EquityChart from '$lib/components/charts/EquityChart.svelte';
	import DailyPnlChart from '$lib/components/charts/DailyPnlChart.svelte';
	import CumulativePnlChart from '$lib/components/charts/CumulativePnlChart.svelte';
	import TradingScoreRadar from '$lib/components/charts/TradingScoreRadar.svelte';
	import DrawdownChart from '$lib/components/charts/DrawdownChart.svelte';
	import TradeTimeChart from '$lib/components/charts/TradeTimeChart.svelte';
	import TradeDurationChart from '$lib/components/charts/TradeDurationChart.svelte';
	import MiniCalendar from '$lib/components/portfolio/MiniCalendar.svelte';
	import ActivityHeatmap from '$lib/components/portfolio/ActivityHeatmap.svelte';
	import OverviewSkeleton from '$lib/components/portfolio/OverviewSkeleton.svelte';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import StartMyDayModal from '$lib/components/portfolio/StartMyDayModal.svelte';
	import AiCoachCard from '$lib/components/portfolio/AiCoachCard.svelte';
	import DayInsightsSection from '$lib/components/portfolio/DayInsightsSection.svelte';
	import RiskOfRuinGauge from '$lib/components/portfolio/RiskOfRuinGauge.svelte';
	import BestWorstCard from '$lib/components/portfolio/BestWorstCard.svelte';
	import MonthlyGoalCard from '$lib/components/portfolio/MonthlyGoalCard.svelte';
	import { formatCurrency, formatDateTime, formatNumber, formatPercent, formatPnl, timeAgo } from '$lib/utils';
	import { getTradeReviewStatus } from '$lib/portfolio';
	import { displayUnit } from '$lib/stores/displayUnit';
	import { marketNewsStore } from '$lib/stores/newsStore';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { subscribeOpenPositions, type OpenPositionRow } from '$lib/realtime/openPositions';

	let { data } = $props();

	let {
		latestStats,
		openPositions: ssrOpenPositions,
		recentTrades,
		allFilteredTrades,
		dailyHistory,
		equityCurve,
		equitySnapshots,
		drawdownHistory,
		intradayDrawdown,
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
		today,
		todayInsights,
		todaySummary,
		sessionBreakdown,
		showWeeklyNudge,
		riskOfRuin,
		streaks,
		bestWorst,
		monthlyGoal
	} = $derived(data);

	let startMyDayOpen = $state(false);
	let tradesTab = $state<'recent' | 'open'>('recent');

	// Live open positions — seeded from SSR, then kept in sync via Supabase Realtime.
	// Re-seed + re-subscribe whenever the account switches.
	let livePositions = $state<OpenPositionRow[]>([]);
	const openPositions = $derived(livePositions);

	$effect(() => {
		const accountId = data.account?.id;
		const seed = (ssrOpenPositions ?? []) as OpenPositionRow[];
		livePositions = seed;
		if (!accountId) return;
		return subscribeOpenPositions(accountId, seed, (next) => {
			livePositions = next;
		});
	});
	let aiCoachExpanded = $state(false);
	let settingsButtonEl = $state<HTMLButtonElement | null>(null);
	let settingsPanelEl = $state<HTMLDivElement | null>(null);

	// Row visibility toggle (Fix 1)
	let rowVisibility = $state<Record<string, boolean>>({
		kpis: true,
		scoreRow: true,
		chartsRow: true,
		calendarRow: true,
		scatterRow: true,
		extrasRow: true,
		riskRow: true,
		highlightsRow: true,
		goalsRow: true,
	});
	let settingsOpen = $state(false);

	// Load saved row visibility from localStorage once on mount (avoids effect loop)
	onMount(() => {
		try {
			const saved = localStorage.getItem('dashboard-rows');
			if (saved) rowVisibility = { ...rowVisibility, ...JSON.parse(saved) };
		} catch { /* ignore */ }
		autoRefreshTimer = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			void invalidate('portfolio:baseData');
		}, 30_000);
		return () => {
			if (autoRefreshTimer) clearInterval(autoRefreshTimer);
		};
	});

	let safeCommandCenter = $derived(commandCenter || {
		today: { pnl: 0, trades: 0, reviewedTrades: 0, completedJournal: false },
		reviewSummary: { unreviewed: 0 },
		unreviewedTrades: [],
		activePlaybooks: 0
	});
	let safeRuleBreakMetrics = $derived(ruleBreakMetrics || { totalRuleBreaks: 0, ruleBreakLoss: 0, topRules: [] });
	let safeSetupPerformance = $derived(setupPerformance || []);

	let kpi = $derived(kpiMetrics || {
		netPnl: 0, totalTrades: 0, winningTrades: 0, losingTrades: 0, breakEvenTrades: 0,
		tradeWinRate: 0, profitFactor: 0, dayWinRate: 0, profitableDays: 0,
		totalTradingDays: 0, avgWin: 0, avgLoss: 0, avgWinLossRatio: 0, cumulativePnl: [],
		recoveryFactor: 0, maxDrawdownPct: 0, consistency: 0
	});
	let totalTrades = $derived(kpi.totalTrades);
	let winCount = $derived(kpi.winningTrades);
	let lossCount = $derived(kpi.losingTrades);

	let checklistDone = $derived((checklistCompletions || []).filter((c: any) => c.completed).length);
	let checklistTotal = $derived((checklistRules || []).length);

	function streakLabel(n: number) {
		if (n === 0) return null;
		return n > 0 ? `${n}W` : `${Math.abs(n)}L`;
	}
	let tradeStreakText = $derived(streaks?.trade ? streakLabel(streaks.trade.current) : null);
	let dayStreakText = $derived(streaks?.day ? streakLabel(streaks.day.current) : null);
	let tradeStreakClass = $derived(
		streaks?.trade && streaks.trade.current > 0 ? 'text-green-400' :
		streaks?.trade && streaks.trade.current < 0 ? 'text-red-400' : 'text-gray-400'
	);
	let dayStreakClass = $derived(
		streaks?.day && streaks.day.current > 0 ? 'text-green-400' :
		streaks?.day && streaks.day.current < 0 ? 'text-red-400' : 'text-gray-400'
	);

	// Sync
	let account = $derived(data.account);
	let bridgeStatus = $derived((data as any).bridgeStatus as string | null);
	let isBridgeRunning = $derived(bridgeStatus === 'running');
	let syncingNow = $state(false);
	let syncError = $state<string | null>(null);
	let syncCooldown = $state(false);
	let syncSuccess = $state(false);
	let cooldownTimer: ReturnType<typeof setTimeout> | undefined;
	let successTimer: ReturnType<typeof setTimeout> | undefined;
	let autoRefreshTimer: ReturnType<typeof setInterval> | undefined;

	// Persist row visibility
	function saveRowVisibility() {
		if (typeof window !== 'undefined') {
			localStorage.setItem('dashboard-rows', JSON.stringify(rowVisibility));
		}
	}

	function closeSettingsPopover() {
		settingsOpen = false;
		settingsButtonEl?.focus();
	}

	$effect(() => {
		if (!settingsOpen) return;

		requestAnimationFrame(() => settingsPanelEl?.focus());

		function handleDocumentPointerDown(e: MouseEvent) {
			const target = e.target as Node | null;
			if (!target) return;
			if (settingsPanelEl?.contains(target) || settingsButtonEl?.contains(target)) return;
			settingsOpen = false;
		}

		function handleDocumentKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				closeSettingsPopover();
			}
		}

		document.addEventListener('mousedown', handleDocumentPointerDown);
		document.addEventListener('keydown', handleDocumentKeydown);
		return () => {
			document.removeEventListener('mousedown', handleDocumentPointerDown);
			document.removeEventListener('keydown', handleDocumentKeydown);
		};
	});

	const rowOptions: [string, string][] = [
		['kpis', 'KPI Cards'],
		['riskRow', 'Risk of Ruin & Goals'],
		['scoreRow', 'Score & Progress'],
		['chartsRow', 'Charts & Trades'],
		['highlightsRow', 'Best / Worst Trade'],
		['calendarRow', 'Calendar & Drawdown'],
		['scatterRow', 'Time & Duration'],
		['extrasRow', 'Rule Breaks & Setup'],
	];

	async function triggerSync() {
		if (syncingNow || syncCooldown || !account) return;
		syncingNow = true; syncError = null; syncSuccess = false;
		try {
			const res = await fetch('/api/portfolio/sync-trigger', { method: 'POST' });
			if (res.status === 429) { syncError = 'กรุณารอ 60 วินาที'; }
			else if (!res.ok) { const b = await res.json().catch(() => ({})); syncError = b.message || 'เกิดข้อผิดพลาด'; }
			else {
				syncSuccess = true; syncCooldown = true;
				clearTimeout(cooldownTimer);
				clearTimeout(successTimer);
				cooldownTimer = setTimeout(() => { syncCooldown = false; }, 60_000);
				successTimer = setTimeout(() => { syncSuccess = false; }, 4_000);
				await invalidate('portfolio:baseData');
			}
		} catch { syncError = 'ไม่สามารถเชื่อมต่อได้'; }
		finally { syncingNow = false; }
	}

	// Cleanup timers on destroy
	$effect(() => {
		return () => {
			clearTimeout(cooldownTimer);
			clearTimeout(successTimer);
		};
	});
</script>

{#if !data.account}
	<div class="card text-center py-12">
		<h2 class="text-lg font-medium text-white mb-2">ยังไม่มีบัญชีที่อนุมัติ</h2>
		<p class="text-sm text-gray-400">กรุณาติดต่อ Master IB ของคุณ</p>
	</div>
{:else if !latestStats && !kpiMetrics}
	<OverviewSkeleton />
{:else}
	<div class="space-y-4">

		<!-- ── Filter Bar ─────────────────────────────────────────────────── -->
		<PortfolioFilterBar
			filters={filterState}
			{filterOptions}
			{tags}
			{playbooks}
			pageKey="overview"
		/>

		<!-- ── Sync + Command subbar ──────────────────────────────────────── -->
		<div class="rounded-xl border border-dark-border bg-dark-surface/50 px-4 py-2.5 -mt-1 space-y-1.5">
			<!-- Line 1: Sync status -->
			<div class="flex items-center justify-between text-xs text-gray-400">
				<div class="flex items-center gap-3">
					{#if isBridgeRunning}
						<span class="relative flex h-2 w-2">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
							<span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
						</span>
					{/if}
					<span>
						ซิงค์ล่าสุด:
						{#if account?.last_synced_at}
							{timeAgo(account.last_synced_at)}
						{:else}
							ยังไม่เคยซิงค์
						{/if}
					</span>
					<button
						onclick={triggerSync}
						disabled={syncingNow || syncCooldown}
						class="text-brand-primary hover:text-brand-primary/80 disabled:text-gray-500 transition-colors font-medium focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none rounded"
					>
						{syncingNow ? 'กำลัง Sync...' : 'Resync'}
					</button>
					{#if syncSuccess}
						<span class="text-green-400">✓ สำเร็จ</span>
					{/if}
					{#if syncError}
						<span class="text-red-400">{syncError}</span>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<!-- Settings toggle -->
					<div class="relative">
						<button
							bind:this={settingsButtonEl}
							onclick={() => settingsOpen = !settingsOpen}
							class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-dark-hover transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none"
							aria-label="ตั้งค่าแดชบอร์ด"
							aria-expanded={settingsOpen}
							aria-controls="dashboard-settings-popover"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
							</svg>
						</button>
						{#if settingsOpen}
							<div
								bind:this={settingsPanelEl}
								id="dashboard-settings-popover"
								class="absolute right-0 top-8 z-50 w-56 bg-dark-surface border border-dark-border rounded-xl p-3 shadow-xl focus:outline-none"
								aria-label="Dashboard settings"
								tabindex="-1"
							>
								<p class="text-[10px] uppercase tracking-wider text-gray-500 mb-2">แสดง/ซ่อน Section</p>
								{#each rowOptions as [key, label] (key)}
									<label class="flex items-center justify-between py-1.5 text-xs text-gray-300 cursor-pointer hover:text-white">
										{label}
										<input type="checkbox" bind:checked={rowVisibility[key]}
											onchange={saveRowVisibility}
											class="rounded border-dark-border bg-dark-bg accent-brand-primary" />
									</label>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Start my day -->
					<button
						onclick={() => startMyDayOpen = true}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none
							{checklistDoneToday ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-brand-primary text-dark-bg'}"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{#if checklistDoneToday}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
							{/if}
						</svg>
						{checklistDoneToday ? 'พร้อมเทรด' : 'Start my day'}
					</button>
				</div>
			</div>

			<!-- Line 2: Today's command center -->
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs border-t border-gray-700/40 pt-1.5">
				<div class="flex items-center gap-1.5">
					<span class="text-gray-400">P/L วันนี้</span>
					<span class="font-semibold {safeCommandCenter.today.pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatPnl(safeCommandCenter.today.pnl || 0, $displayUnit, latestStats?.balance)}
					</span>
				</div>
				<span class="text-gray-600">·</span>
				<div class="flex items-center gap-1.5">
					<span class="text-gray-400">เทรด</span>
					<span class="text-white font-medium">{safeCommandCenter.today.trades || 0}</span>
				</div>
				<span class="text-gray-600">·</span>
				<div class="flex items-center gap-1.5">
					<span class="text-gray-400">รีวิวแล้ว</span>
					<span class="text-white font-medium">{safeCommandCenter.today.reviewedTrades || 0}</span>
				</div>
				<span class="text-gray-600">·</span>
				<div class="flex items-center gap-1.5">
					<span class="text-gray-400">Journal</span>
					<span class="{safeCommandCenter.today.completedJournal ? 'text-green-400' : 'text-amber-300'}">
						{safeCommandCenter.today.completedJournal ? '✓ เสร็จ' : '⏳ รอบันทึก'}
					</span>
				</div>
				{#if safeCommandCenter.reviewSummary.unreviewed > 0}
					<span class="text-gray-600">·</span>
					<a href="/portfolio/trades" class="flex items-center gap-1 text-amber-400 hover:text-amber-300">
						<span class="font-medium">{safeCommandCenter.reviewSummary.unreviewed}</span>
						<span>รอรีวิว</span>
					</a>
				{/if}
				{#if tradeStreakText && streaks}
					<span class="text-gray-600">·</span>
					<div class="flex items-center gap-1.5" title="สตรีคสูงสุด: {streaks.trade.longestWin}W / {streaks.trade.longestLoss}L">
						<span class="text-gray-400">🔥 Streak</span>
						<span class="font-medium {tradeStreakClass}">{tradeStreakText}</span>
					</div>
				{/if}
				{#if dayStreakText && streaks}
					<span class="text-gray-600">·</span>
					<div class="flex items-center gap-1.5" title="สตรีคสูงสุด (วัน): {streaks.day.longestWin}W / {streaks.day.longestLoss}L">
						<span class="text-gray-400">📅 วัน</span>
						<span class="font-medium {dayStreakClass}">{dayStreakText}</span>
					</div>
				{/if}
				{#if showWeeklyNudge}
					<span class="text-gray-600">·</span>
					<a
						href="/portfolio/analytics"
						class="flex items-center gap-1 text-brand-primary hover:text-brand-primary/80 font-medium"
						title="AI วิเคราะห์ performance, patterns, และแผนสัปดาห์หน้า"
					>
						<span>📊 สรุปสัปดาห์ที่แล้ว</span>
						<span>→</span>
					</a>
				{/if}
			</div>
		</div>

		<!-- ── Row A: 5 KPI Cards ─────────────────────────────────────────── -->
		{#if rowVisibility.kpis}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
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
				gaugeValue={kpi.profitFactor >= 999 ? 3 : kpi.profitFactor}
				gaugeMax={3}
			/>
			<MetricCard
				label="อัตราชนะ (วัน)"
				value={formatPercent(kpi.dayWinRate).replace('+', '')}
				color={kpi.dayWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}
				donutPercent={kpi.dayWinRate}
				tradeCount={kpi.totalTradingDays > 0 ? { wins: kpi.profitableDays, losses: kpi.totalTradingDays - kpi.profitableDays } : undefined}
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
		</div>

		<!-- Secondary KPIs -->
		<div class="grid grid-cols-2 gap-2 px-1 sm:grid-cols-4">
			<div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
				<div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 sm:text-xs">Balance</div>
				<div class="mt-1 text-base font-semibold text-white sm:text-lg">{formatCurrency(latestStats?.balance || 0)}</div>
			</div>
			<div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
				<div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 sm:text-xs">Equity</div>
				<div class="mt-1 text-base font-semibold text-white sm:text-lg">{formatCurrency(latestStats?.equity || 0)}</div>
			</div>
			<div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
				<div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 sm:text-xs">Expected Value</div>
				<div class="mt-1 text-base font-semibold sm:text-lg {kpi.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
					{formatCurrency(totalTrades > 0 ? kpi.netPnl / totalTrades : 0)}
				</div>
			</div>
			<div class="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
				<div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 sm:text-xs">Recovery Factor</div>
				<div class="mt-1 text-base font-semibold text-white sm:text-lg">{formatNumber(kpi.recoveryFactor || 0, 2)}</div>
			</div>
		</div>
		{/if}

		<!-- ── Risk of Ruin + Monthly Goal ────────────────────────────────── -->
		{#if rowVisibility.riskRow}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<div class="card">
				<DeferRender>
					<RiskOfRuinGauge data={riskOfRuin} />
				</DeferRender>
			</div>
			<DeferRender>
				<MonthlyGoalCard data={monthlyGoal} />
			</DeferRender>
		</div>
		{/if}

		<!-- ── Today's Insight + Session Breakdown + Weekly Nudge ─────────── -->
		{#if todaySummary}
			<div class="card space-y-3">
				<div class="flex items-center justify-between flex-wrap gap-2">
					<h3 class="text-sm font-medium text-white">📊 วันนี้ของคุณ</h3>
					<span class="text-xs">
						<span class="text-gray-400">{todaySummary.totalTrades} เทรด · </span>
						<span class="{todaySummary.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">
							{formatPnl(todaySummary.totalPnl, $displayUnit, latestStats?.balance)}
						</span>
						<span class="text-gray-400"> · Win Rate {todaySummary.winRate.toFixed(0)}%</span>
					</span>
				</div>

				{#if sessionBreakdown && sessionBreakdown.length > 0}
					<div class="grid grid-cols-3 gap-2">
						{#each sessionBreakdown as s}
							<div class="rounded-lg bg-dark-bg/40 border border-dark-border p-2.5">
								<div class="text-[10px] text-gray-400 uppercase tracking-wider">
									{s.session === 'asian' ? 'Asian' : s.session === 'london' ? 'London' : 'New York'}
								</div>
								<div class="text-sm font-semibold mt-1 {s.trades === 0 ? 'text-gray-500' : s.pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
									{s.trades === 0 ? '—' : formatCurrency(s.pnl)}
								</div>
								<div class="text-[10px] text-gray-400 mt-0.5">
									{s.trades === 0 ? 'ไม่มีเทรด' : `${s.trades} เทรด · WR ${s.winRate.toFixed(0)}%`}
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if todayInsights && todayInsights.length > 0}
					<DayInsightsSection insights={todayInsights} />
				{/if}
			</div>
		{/if}

		<!-- ── Row B: Radar | Activity Heatmap | Cumulative P&L ─────────── -->
		{#if rowVisibility.scoreRow}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Trading Score -->
			<div class="card">
				<DeferRender>
					<TradingScoreRadar
						winRate={kpi.tradeWinRate}
						profitFactor={kpi.profitFactor >= 999 ? 3 : kpi.profitFactor}
						avgWin={kpi.avgWin}
						avgLoss={kpi.avgLoss}
						recoveryFactor={kpi.recoveryFactor || 0}
						maxDrawdownPct={intradayDrawdown?.maxDrawdownPct ?? kpi.maxDrawdownPct ?? 0}
						consistency={kpi.consistency || 0}
					/>
				</DeferRender>
			</div>

			<!-- Activity Heatmap / Progress Tracker -->
			<div class="h-full">
				<DeferRender>
					<ActivityHeatmap
						{dailyHistory}
						{checklistDone}
						{checklistTotal}
						onChecklistClick={() => startMyDayOpen = true}
					/>
				</DeferRender>
			</div>

			<!-- Daily Net Cumulative P&L -->
			<div class="card flex flex-col">
				<DeferRender>
					{#if kpi.cumulativePnl && kpi.cumulativePnl.length > 1}
						<CumulativePnlChart data={kpi.cumulativePnl} />
					{:else}
						<EmptyState message="ยังไม่มีข้อมูล" />
					{/if}
				</DeferRender>
			</div>
		</div>
		{/if}

		<!-- ── Row C: Daily P&L | Trades Table | Account Balance ─────────── -->
		{#if rowVisibility.chartsRow}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Net Daily P&L bar -->
			<div class="card flex flex-col">
				<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">P&L รายวัน</p>
				<DeferRender>
					{#if dailyHistory && dailyHistory.length > 0}
						<div class="flex-1 flex flex-col min-h-0">
							<DailyPnlChart {dailyHistory} />
						</div>
					{:else}
						<EmptyState message="ยังไม่มีข้อมูล" />
					{/if}
				</DeferRender>
			</div>

			<!-- Recent Trades / Open Positions tabbed -->
			<div class="card">
				<!-- Tabs -->
				<div class="flex items-center gap-4 border-b border-gray-700/50 mb-3 -mt-1">
					<button
						onclick={() => tradesTab = 'recent'}
						class="pb-2 text-sm font-medium transition-colors border-b-2 -mb-px focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none
							{tradesTab === 'recent' ? 'text-brand-primary border-brand-primary' : 'text-gray-400 border-transparent hover:text-white'}"
					>
						เทรดล่าสุด
						{#if safeCommandCenter.reviewSummary.unreviewed > 0}
							<span class="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
								{safeCommandCenter.reviewSummary.unreviewed}
							</span>
						{/if}
					</button>
					<button
						onclick={() => tradesTab = 'open'}
						class="pb-2 text-sm font-medium transition-colors border-b-2 -mb-px focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none
							{tradesTab === 'open' ? 'text-brand-primary border-brand-primary' : 'text-gray-400 border-transparent hover:text-white'}"
					>
						Open positions
						{#if openPositions.length > 0}
							<span class="ml-1 px-1.5 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary text-[10px]">
								{openPositions.length}
							</span>
						{/if}
					</button>
					<a href="/portfolio/trades" class="ml-auto text-[11px] text-brand-primary hover:underline">ดูทั้งหมด</a>
				</div>

				{#if tradesTab === 'recent'}
					{#if recentTrades.length === 0}
						<EmptyState message="ไม่พบ trade" />
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full text-xs">
								<thead>
									<tr class="border-b border-gray-700/50 text-gray-500">
										<th class="text-left py-1.5">วันที่</th>
										<th class="text-left py-1.5">สัญลักษณ์</th>
										<th class="text-right py-1.5">P&L</th>
									</tr>
								</thead>
								<tbody>
									{#each recentTrades as trade (trade.id)}
										{@const reviewStatus = getTradeReviewStatus(trade)}
										<tr class="border-b border-gray-700/30 {reviewStatus !== 'reviewed' ? 'bg-amber-500/5' : ''}">
											<td class="py-2 text-gray-400">{formatDateTime(trade.close_time)}</td>
											<td class="py-2">
												<a href={`/portfolio/trades/${trade.id}`}
													class="font-medium text-white hover:text-brand-primary">{trade.symbol}</a>
												{#if reviewStatus !== 'reviewed'}
													<span class="ml-1 text-[9px] text-amber-400 border border-amber-400/30 rounded px-1">รอรีวิว</span>
												{/if}
											</td>
											<td class="py-2 text-right font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
												{formatCurrency(trade.profit)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{:else}
					{#if openPositions.length === 0}
						<EmptyState message="ไม่มี position เปิดอยู่" />
					{:else}
						<div class="space-y-1.5">
							{#each openPositions as pos (pos.id || pos.symbol)}
								<div class="flex items-center justify-between rounded-lg bg-dark-bg/40 px-3 py-2 text-xs">
									<div>
										<span class="font-medium text-white">{pos.symbol}</span>
										<span class="text-gray-500 ml-1.5">{pos.type} · {pos.lot_size}L</span>
									</div>
									<span class="font-semibold {pos.current_profit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(pos.current_profit)}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>

			<!-- Account Balance chart -->
			<div class="card">
				<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">ยอดเงิน</p>
				<DeferRender>
					{#if equitySnapshots && equitySnapshots.length > 1}
						<EquityChart {equitySnapshots} {equityCurve} />
					{:else}
						<EmptyState message="ยังไม่มีข้อมูล" />
					{/if}
				</DeferRender>
			</div>
		</div>
		{/if}

		<!-- ── Best / Worst Trade Highlights ──────────────────────────────── -->
		{#if rowVisibility.highlightsRow && (bestWorst?.best || bestWorst?.worst)}
			<DeferRender>
				<BestWorstCard best={bestWorst.best} worst={bestWorst.worst} />
			</DeferRender>
		{/if}

		<!-- ── Row D: Calendar (2/3) + Drawdown (1/3) ────────────────────── -->
		{#if rowVisibility.calendarRow}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<div class="card lg:col-span-2">
				<DeferRender>
					<MiniCalendar {dailyHistory} showWeekSummary={true} />
				</DeferRender>
			</div>
			<div class="card">
				<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">Drawdown</p>
				<DeferRender>
					<DrawdownChart drawdownData={drawdownHistory || []} intradayData={intradayDrawdown} />
				</DeferRender>
			</div>
		</div>
		{/if}

		<!-- ── Row E: Trade Duration + Trade Time (scatter) ──────────────── -->
		{#if rowVisibility.scatterRow}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<div class="card">
				<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">Trade Duration Performance</p>
				<DeferRender>
					<TradeDurationChart trades={(allFilteredTrades || []).slice(0, 2000)} />
				</DeferRender>
			</div>
			<div class="card">
				<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">Trade Time Performance</p>
				<DeferRender>
					<TradeTimeChart trades={(allFilteredTrades || []).slice(0, 2000)} />
				</DeferRender>
			</div>
		</div>
		{/if}

		<!-- ── AI Coach (collapsible) ─────────────────────────────────────── -->
		<div class="card overflow-hidden">
			<button
				onclick={() => aiCoachExpanded = !aiCoachExpanded}
				class="w-full flex items-center justify-between py-1 text-left"
			>
				<div class="flex items-center gap-2">
					<span class="text-lg">🤖</span>
					<span class="text-[10px] uppercase tracking-[0.2em] text-gray-400">AI Coach</span>
				</div>
				<svg class="w-4 h-4 text-gray-400 transition-transform {aiCoachExpanded ? 'rotate-180' : ''}"
					fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
				</svg>
			</button>
			{#if aiCoachExpanded}
				<div class="mt-3 border-t border-dark-border pt-3">
					<DeferRender>
						<AiCoachCard />
					</DeferRender>
				</div>
			{/if}
		</div>

		<!-- ── Row F: Rule Breaks + Setup Performance ─────────────────────── -->
		{#if rowVisibility.extrasRow}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
			<!-- Rule Breaks -->
			<div class="card">
				<div class="flex items-center justify-between mb-3">
					<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400">ต้นทุนความผิดพลาด</p>
					<a href="/portfolio/analytics" class="text-[11px] text-brand-primary">เปิด report</a>
				</div>
				<div class="grid grid-cols-2 gap-2 mb-3">
					<div class="rounded-lg border border-dark-border bg-dark-bg/30 p-2.5">
						<div class="text-[10px] text-gray-400">กฎที่ผิด</div>
						<div class="text-xl font-semibold text-white mt-0.5">{safeRuleBreakMetrics.totalRuleBreaks || 0}</div>
					</div>
					<div class="rounded-lg border border-dark-border bg-dark-bg/30 p-2.5">
						<div class="text-[10px] text-gray-400">ขาดทุนจากผิดกฎ</div>
						<div class="text-xl font-semibold text-red-400 mt-0.5">{formatCurrency(safeRuleBreakMetrics.ruleBreakLoss || 0)}</div>
					</div>
				</div>
				{#if safeRuleBreakMetrics.topRules.length > 0}
					<div class="space-y-1.5">
						{#each safeRuleBreakMetrics.topRules as rule (rule.rule)}
							<div class="flex items-center justify-between rounded-lg bg-dark-bg/30 px-3 py-2 text-xs">
								<span class="text-gray-300">{rule.rule}</span>
								<span class="text-gray-400">{rule.count}x · <span class="text-red-300">{formatCurrency(rule.loss)}</span></span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-xs text-gray-500 text-center py-2">ยังไม่มีการผิดกฎที่บันทึกไว้</p>
				{/if}
			</div>

			<!-- Setup Performance -->
			<div class="card">
				<div class="flex items-center justify-between mb-3">
					<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400">ผลงาน Setup</p>
					<a href="/portfolio/playbook" class="text-[11px] text-brand-primary">จัดการ playbook</a>
				</div>
				{#if safeSetupPerformance.length > 0}
					<div class="space-y-1.5">
						{#each safeSetupPerformance.slice(0, 5) as setup (setup.name)}
							<div class="flex items-center justify-between rounded-lg bg-dark-bg/30 px-3 py-2.5 text-xs">
								<div>
									<div class="font-medium text-white">{setup.name}</div>
									<div class="text-gray-500 mt-0.5">{setup.totalTrades} trades · {setup.winRate.toFixed(0)}% win</div>
								</div>
								<div class="text-right">
									<div class="font-semibold {setup.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(setup.totalProfit)}
									</div>
									<div class="text-gray-500">Exp {formatCurrency(setup.expectancy)}</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<EmptyState message="ยังไม่มี data ของ setup / playbook" />
				{/if}
			</div>
		</div>
		{/if}

	</div>

	<!-- Start My Day modal -->
	<StartMyDayModal
		open={startMyDayOpen}
		onclose={() => startMyDayOpen = false}
		checklistRules={(checklistRules as any) || []}
		checklistCompletions={(checklistCompletions as any) || []}
		checklistDoneToday={checklistDoneToday || false}
		todayJournal={(todayJournal as any) || null}
		marketNews={($marketNewsStore as any) || []}
	/>
{/if}
