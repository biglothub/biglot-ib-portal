<script lang="ts">
	import DaySparkline from '$lib/components/charts/DaySparkline.svelte';
	import DayNoteModal from '$lib/components/portfolio/DayNoteModal.svelte';
	import { formatCurrency, formatNumber, formatPercent } from '$lib/utils';
	import type { Trade } from '$lib/types';

	let {
		entry,
		defaultExpanded = false
	}: {
		entry: {
			date: string;
			netPnl: number;
			grossPnl: number;
			totalTrades: number;
			winners: number;
			losers: number;
			winRate: number;
			commissions: number;
			volume: number;
			profitFactor: number;
			intradayCumPnl: Array<{ time: number; value: number }>;
			trades: Trade[];
		};
		defaultExpanded?: boolean;
	} = $props();

	let expanded = $state(false);
	let showTrades = $state(false);
	let showNoteModal = $state(false);

	// Sync expanded state when defaultExpanded changes (e.g. calendar navigation)
	$effect(() => {
		expanded = defaultExpanded;
		if (!defaultExpanded) showTrades = false;
	});

	function formatDateHeader(dateStr: string) {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
	}

	function toggleExpanded() {
		const nextExpanded = !expanded;
		expanded = nextExpanded;
		if (!nextExpanded) showTrades = false;
	}
</script>

<article id="day-{entry.date}" class="card overflow-hidden">
	<!-- Header row -->
	<div class="flex items-center gap-2 py-1">
		<button type="button" onclick={toggleExpanded} class="flex min-w-0 flex-1 items-center gap-3 text-left">
			<svg
				class="w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 {expanded ? 'rotate-90' : ''}"
				fill="none" stroke="currentColor" viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>

			<span class="text-sm font-semibold text-white">{formatDateHeader(entry.date)}</span>

			<span class="min-w-0 text-sm font-mono ml-1 {entry.netPnl > 0 ? 'text-green-400' : entry.netPnl < 0 ? 'text-red-400' : 'text-gray-400'}">
				Net P&L {formatCurrency(entry.netPnl)}
			</span>
		</button>

		<button
			type="button"
			onclick={(e) => { e.stopPropagation(); showNoteModal = true; }}
			class="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-gray-700/50 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-brand-primary/40 hover:text-white"
		>
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			บันทึก
		</button>
	</div>

	{#if expanded}
		<!-- Body: sparkline left + stats grid right -->
		<div class="mt-3 grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-4 border-t border-gray-700/40 pt-3">
			<!-- Mini sparkline -->
			<div class="flex items-center justify-center">
				{#if entry.intradayCumPnl.length >= 2}
					<DaySparkline data={entry.intradayCumPnl} height={72} />
				{:else}
					<div class="h-[72px] w-full flex items-center justify-center text-xs text-gray-500">—</div>
				{/if}
			</div>

			<!-- Stats grid (Tradezella style) -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5 text-sm">
				<div>
					<div class="text-[11px] text-gray-400">Total Trades</div>
					<div class="font-semibold text-white">{entry.totalTrades}</div>
				</div>
				<div>
					<div class="text-[11px] text-gray-400">Gross P&L</div>
					<div class="font-semibold {entry.grossPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(entry.grossPnl)}</div>
				</div>
				<div>
					<div class="text-[11px] text-gray-400">Winners / Losers</div>
					<div class="font-semibold text-white">
						<span class="text-green-400">{entry.winners}</span>
						<span class="text-gray-400 mx-0.5">/</span>
						<span class="text-red-400">{entry.losers}</span>
					</div>
				</div>
				<div>
					<div class="text-[11px] text-gray-400">Commissions</div>
					<div class="font-semibold text-white">{formatCurrency(entry.commissions)}</div>
				</div>
				<div>
					<div class="text-[11px] text-gray-400">Win Rate</div>
					<div class="font-semibold {entry.winRate >= 50 ? 'text-green-400' : 'text-amber-400'}">{formatPercent(entry.winRate, 1)}</div>
				</div>
				<div>
					<div class="text-[11px] text-gray-400">Volume</div>
					<div class="font-semibold text-white">{formatNumber(entry.volume, 2)}</div>
				</div>
				<div>
					<div class="text-[11px] text-gray-400">Profit Factor</div>
					<div class="font-semibold {entry.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{formatNumber(entry.profitFactor, 2)}</div>
				</div>
			</div>
		</div>

		<!-- Double expand: trade list -->
		<div class="mt-3 border-t border-gray-700/40 pt-2">
			<button
				onclick={() => showTrades = !showTrades}
				class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
			>
				<svg
					class="w-3 h-3 transition-transform duration-200 {showTrades ? 'rotate-90' : ''}"
					fill="none" stroke="currentColor" viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				{showTrades ? 'ซ่อน trades' : `แสดง ${entry.totalTrades} trades`}
			</button>

			{#if showTrades}
				<div class="mt-2 overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-gray-700/50 text-gray-400 text-xs">
								<th class="text-left py-2">เวลา</th>
								<th class="text-left py-2">สัญลักษณ์</th>
								<th class="text-left py-2">ประเภท</th>
								<th class="text-right py-2">ล็อต</th>
								<th class="text-right py-2">ราคาเปิด</th>
								<th class="text-right py-2">ราคาปิด</th>
								<th class="text-right py-2">กำไร/ขาดทุน</th>
							</tr>
						</thead>
						<tbody>
							{#each entry.trades as trade}
								<tr class="border-b border-gray-700/30 hover:bg-dark-bg/30">
									<td class="py-2.5 text-gray-400 text-xs">
										{new Date(trade.close_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
									</td>
									<td class="py-2.5">
										<a href="/portfolio/trades/{trade.id}" class="font-medium text-white hover:text-brand-primary">{trade.symbol}</a>
									</td>
									<td class="py-2.5">
										<span class="text-xs px-1.5 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
											{trade.type}
										</span>
									</td>
									<td class="py-2.5 text-right text-gray-400">{formatNumber(trade.lot_size, 2)}</td>
									<td class="py-2.5 text-right text-gray-400">{formatNumber(trade.open_price, 5)}</td>
									<td class="py-2.5 text-right text-gray-400">{formatNumber(trade.close_price, 5)}</td>
									<td class="py-2.5 text-right font-medium {Number(trade.profit) >= 0 ? 'text-green-400' : 'text-red-400'}">
										{formatCurrency(trade.profit)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</article>

{#if showNoteModal}
	<DayNoteModal
		date={entry.date}
		netPnl={entry.netPnl}
		totalTrades={entry.totalTrades}
		winRate={entry.winRate}
		onclose={() => showNoteModal = false}
	/>
{/if}
