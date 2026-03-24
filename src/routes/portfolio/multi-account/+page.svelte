<script lang="ts">
	import { formatCurrency, formatPercent, formatNumber, timeAgo } from '$lib/utils';

	let { data } = $props();
	let { accountSummaries, combined, isAdminView } = $derived(data);

	const pnlColor = (v: number) =>
		v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';

	const pnlBg = (v: number) =>
		v > 0 ? 'bg-green-400/10 border-green-400/20' : v < 0 ? 'bg-red-400/10 border-red-400/20' : 'bg-dark-surface border-dark-border';

	const barColor = (v: number) =>
		v > 0 ? 'bg-green-400' : v < 0 ? 'bg-red-400' : 'bg-gray-600';
</script>

<svelte:head>
	<title>มัลติบัญชี — IB Portal</title>
</svelte:head>

{#if isAdminView}
	<!-- Admin view not supported -->
	<div class="card flex flex-col items-center justify-center py-16 text-center">
		<svg class="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
		</svg>
		<p class="text-gray-400">ไม่รองรับ Admin View สำหรับหน้านี้</p>
	</div>

{:else if !accountSummaries || accountSummaries.length === 0}
	<!-- Empty state -->
	<div class="card flex flex-col items-center justify-center py-20 text-center">
		<div class="w-16 h-16 rounded-2xl bg-brand-primary/10 flex items-center justify-center mb-4">
			<svg class="w-8 h-8 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
			</svg>
		</div>
		<h3 class="text-lg font-semibold text-white mb-2">ยังไม่มีบัญชีที่ได้รับอนุมัติ</h3>
		<p class="text-sm text-gray-400 max-w-xs">เมื่อคุณมีหลายบัญชีที่ได้รับอนุมัติ จะแสดงภาพรวมทุกบัญชีที่นี่</p>
	</div>

{:else if accountSummaries.length === 1}
	<!-- Single account — encourage multi -->
	<div class="space-y-6">
		<div class="card flex flex-col items-center justify-center py-16 text-center">
			<div class="w-16 h-16 rounded-2xl bg-amber-400/10 flex items-center justify-center mb-4">
				<svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<h3 class="text-lg font-semibold text-white mb-2">มีบัญชีเดียวในขณะนี้</h3>
			<p class="text-sm text-gray-400 max-w-xs mb-6">
				เมื่อคุณมีหลายบัญชี MT5 ที่ได้รับอนุมัติ คุณจะสามารถเปรียบเทียบผลลัพธ์ทั้งหมดที่นี่ได้
			</p>
			<a
				href="/portfolio"
				class="inline-flex items-center gap-2 rounded-lg bg-brand-primary/20 px-4 py-2 text-sm font-medium text-brand-primary hover:bg-brand-primary/30 transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				กลับสู่พอร์ตหลัก
			</a>
		</div>

		<!-- Show the single account card anyway -->
		{#each accountSummaries as summary}
			{@render accountCard(summary)}
		{/each}
	</div>

{:else}
	<!-- Multi-account view -->
	<div class="space-y-6">

		<!-- Combined summary banner -->
		{#if combined}
			<div class="card border border-brand-primary/20 bg-brand-primary/5">
				<div class="flex items-center gap-2 mb-4">
					<div class="w-2 h-2 rounded-full bg-brand-primary"></div>
					<h2 class="text-sm font-semibold text-brand-primary uppercase tracking-wider">รวมทุกบัญชี</h2>
					<span class="ml-auto text-xs text-gray-400">{accountSummaries.length} บัญชี</span>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-5 gap-4">
					<div>
						<p class="text-xs text-gray-400 mb-1">ยอดรวมบัญชี</p>
						<p class="text-lg font-bold text-white">{formatCurrency(combined.balance)}</p>
					</div>
					<div>
						<p class="text-xs text-gray-400 mb-1">Equity รวม</p>
						<p class="text-lg font-bold text-white">{formatCurrency(combined.equity)}</p>
					</div>
					<div>
						<p class="text-xs text-gray-400 mb-1">P&L รวม (สุทธิ)</p>
						<p class="text-lg font-bold {pnlColor(combined.netPnl)}">{formatCurrency(combined.netPnl)}</p>
					</div>
					<div>
						<p class="text-xs text-gray-400 mb-1">P&L วันนี้ (รวม)</p>
						<p class="text-lg font-bold {pnlColor(combined.todayPnl)}">{formatCurrency(combined.todayPnl)}</p>
					</div>
					<div>
						<p class="text-xs text-gray-400 mb-1">เทรดทั้งหมด</p>
						<p class="text-lg font-bold text-white">{formatNumber(combined.totalTrades, 0)}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- P&L comparison bar chart -->
		<div class="card">
			<h3 class="text-sm font-semibold text-white mb-4">เปรียบเทียบ Net P&L</h3>
			{@render pnlBarChart(accountSummaries)}
		</div>

		<!-- Account cards grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
			{#each accountSummaries as summary}
				{@render accountCard(summary)}
			{/each}
		</div>

		<!-- Comparison table -->
		<div class="card overflow-x-auto">
			<h3 class="text-sm font-semibold text-white mb-4">ตารางเปรียบเทียบ</h3>
			<table class="w-full text-sm min-w-[600px]">
				<thead>
					<tr class="border-b border-dark-border">
						<th class="text-left text-xs text-gray-400 font-medium pb-3 pr-4">บัญชี</th>
						<th class="text-right text-xs text-gray-400 font-medium pb-3 px-3">ยอดบัญชี</th>
						<th class="text-right text-xs text-gray-400 font-medium pb-3 px-3">Net P&L</th>
						<th class="text-right text-xs text-gray-400 font-medium pb-3 px-3">Win Rate</th>
						<th class="text-right text-xs text-gray-400 font-medium pb-3 px-3">Profit Factor</th>
						<th class="text-right text-xs text-gray-400 font-medium pb-3 px-3">เทรด</th>
						<th class="text-right text-xs text-gray-400 font-medium pb-3 pl-3">Max DD</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-dark-border/50">
					{#each accountSummaries as summary}
						<tr class="hover:bg-dark-border/20 transition-colors">
							<td class="py-3 pr-4">
								<div>
									<p class="font-medium text-white text-sm">{summary.account.client_name}</p>
									<p class="text-xs text-gray-400">{summary.account.mt5_account_id}</p>
								</div>
							</td>
							<td class="py-3 px-3 text-right text-white font-medium">
								{formatCurrency(summary.latestBalance)}
							</td>
							<td class="py-3 px-3 text-right font-semibold {pnlColor(summary.netPnl)}">
								{formatCurrency(summary.netPnl)}
							</td>
							<td class="py-3 px-3 text-right text-white">
								{formatPercent(summary.tradeWinRate)}
							</td>
							<td class="py-3 px-3 text-right {summary.profitFactor >= 1.5 ? 'text-green-400' : summary.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}">
								{formatNumber(summary.profitFactor)}
							</td>
							<td class="py-3 px-3 text-right text-gray-300">
								{formatNumber(summary.totalTrades, 0)}
							</td>
							<td class="py-3 pl-3 text-right text-red-400">
								{summary.maxDrawdown !== 0 ? formatCurrency(summary.maxDrawdown) : '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

	</div>
{/if}

{#snippet accountCard(summary: typeof accountSummaries[0])}
	<div class="card flex flex-col gap-4 hover:border-brand-primary/30 transition-colors">
		<!-- Header -->
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<h3 class="font-semibold text-white text-sm truncate">{summary.account.client_name}</h3>
				<p class="text-xs text-gray-400 mt-0.5">{summary.account.mt5_server} · {summary.account.mt5_account_id}</p>
			</div>
			<a
				href="/portfolio"
				class="shrink-0 flex items-center gap-1 rounded-md border border-dark-border px-2 py-1 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors"
				title="ดูพอร์ตบัญชีนี้"
			>
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
				</svg>
				ดู
			</a>
		</div>

		<!-- P&L badge -->
		<div class="rounded-xl border px-4 py-3 {pnlBg(summary.netPnl)}">
			<p class="text-xs text-gray-400 mb-0.5">Net P&L (สุทธิ)</p>
			<p class="text-2xl font-bold {pnlColor(summary.netPnl)}">{formatCurrency(summary.netPnl)}</p>
		</div>

		<!-- Key metrics grid -->
		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-lg bg-dark-surface/60 px-3 py-2.5">
				<p class="text-xs text-gray-400 mb-1">ยอดบัญชี</p>
				<p class="text-sm font-semibold text-white">{formatCurrency(summary.latestBalance)}</p>
			</div>
			<div class="rounded-lg bg-dark-surface/60 px-3 py-2.5">
				<p class="text-xs text-gray-400 mb-1">P&L วันนี้</p>
				<p class="text-sm font-semibold {pnlColor(summary.todayPnl)}">{formatCurrency(summary.todayPnl)}</p>
			</div>
			<div class="rounded-lg bg-dark-surface/60 px-3 py-2.5">
				<p class="text-xs text-gray-400 mb-1">Win Rate</p>
				<p class="text-sm font-semibold text-white">{formatPercent(summary.tradeWinRate)}</p>
			</div>
			<div class="rounded-lg bg-dark-surface/60 px-3 py-2.5">
				<p class="text-xs text-gray-400 mb-1">Profit Factor</p>
				<p class="text-sm font-semibold {summary.profitFactor >= 1.5 ? 'text-green-400' : summary.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'}">
					{formatNumber(summary.profitFactor)}
				</p>
			</div>
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-between text-xs text-gray-400 border-t border-dark-border pt-3">
			<span>{formatNumber(summary.totalTrades, 0)} เทรด</span>
			{#if summary.account.last_synced_at}
				<span>Sync {timeAgo(summary.account.last_synced_at)}</span>
			{:else}
				<span>ยังไม่ได้ Sync</span>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet pnlBarChart(summaries: typeof accountSummaries)}
	{@const maxAbs = summaries.reduce((max, s) => { const v = Math.abs(s.netPnl); return v > max ? v : max; }, 1)}
	<div class="space-y-3">
		{#each summaries as summary}
			<div class="flex items-center gap-3">
				<div class="w-32 shrink-0 text-xs text-gray-400 truncate text-right">{summary.account.client_name}</div>
				<div class="flex-1 flex items-center gap-2">
					<!-- Negative side (left) -->
					<div class="flex-1 flex justify-end">
						{#if summary.netPnl < 0}
							<div
								class="h-5 rounded-l bg-red-400/70"
								style="width: {Math.min((Math.abs(summary.netPnl) / maxAbs) * 100, 100)}%"
							></div>
						{/if}
					</div>
					<!-- Center zero line -->
					<div class="w-px h-5 bg-dark-border shrink-0"></div>
					<!-- Positive side (right) -->
					<div class="flex-1">
						{#if summary.netPnl > 0}
							<div
								class="h-5 rounded-r bg-green-400/70"
								style="width: {Math.min((summary.netPnl / maxAbs) * 100, 100)}%"
							></div>
						{/if}
					</div>
				</div>
				<div class="w-24 shrink-0 text-xs font-medium text-right {pnlColor(summary.netPnl)}">
					{formatCurrency(summary.netPnl)}
				</div>
			</div>
		{/each}
	</div>
{/snippet}
