<script lang="ts">
	import { goto } from '$app/navigation';
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import InsightBadge from '$lib/components/portfolio/InsightBadge.svelte';
	import QualityScoreBar from '$lib/components/portfolio/QualityScoreBar.svelte';
	import { formatCurrency, formatDateTime, formatNumber } from '$lib/utils';
	import { getTradePlaybookId, getTradeReviewStatus, getTradeSession } from '$lib/portfolio';

	let { data } = $props();
	let trades = $derived(data.trades || []);
	let total = $derived(data.total || 0);
	let currentPage = $derived(data.page || 1);
	let pageSize = $derived(data.pageSize || 25);
	let filters = $derived(data.filters);
	let filterOptions = $derived(data.filterOptions);
	let tags = $derived(data.tags || []);
	let playbooks = $derived(data.playbooks || []);
	let savedViews = $derived(data.savedViews || []);
	let tradeInsights: Record<string, any[]> = $derived(data.tradeInsights || {});
	let tradeScores: Record<string, number> = $derived(data.tradeScores || {});
	let tradeExecutionMetrics: Record<string, any> = $derived(data.tradeExecutionMetrics || {});

	let groupBy = $state<'none' | 'day' | 'session' | 'setup'>('day');
	const totalPages = $derived(Math.ceil(total / pageSize));

	function goToPage(pageNumber: number) {
		const params = new URLSearchParams(window.location.search);
		params.set('page', String(pageNumber));
		goto(`/portfolio/trades?${params.toString()}`);
	}

	const groupedTrades = $derived.by(() => {
		if (groupBy === 'none') {
			return [{ label: 'All Trades', items: trades }];
		}

		const groups = new Map<string, any[]>();
		for (const trade of trades) {
				const label =
				groupBy === 'day'
					? new Date(trade.close_time || new Date().toISOString()).toLocaleDateString('th-TH', {
							weekday: 'short',
							day: 'numeric',
							month: 'short'
						})
					: groupBy === 'session'
						? getTradeSession(trade.close_time).toUpperCase()
						: playbooks.find((playbook: any) => playbook.id === getTradePlaybookId(trade))?.name ||
							(trade.trade_tag_assignments || []).find((assignment: any) => assignment.trade_tags?.category === 'setup')?.trade_tags?.name ||
							'No Setup';

			if (!groups.has(label)) groups.set(label, []);
			groups.get(label)!.push(trade);
		}

		return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
	});
</script>

<div class="space-y-6">
	<PortfolioFilterBar
		filters={filters}
		{filterOptions}
		{tags}
		{playbooks}
		{savedViews}
		pageKey="trades"
	/>

	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="card">
			<div class="text-xs text-gray-500">Filtered Trades</div>
			<div class="mt-1 text-2xl font-semibold text-white">{total}</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Unreviewed</div>
			<div class="mt-1 text-2xl font-semibold text-amber-300">
				{trades.filter((trade: any) => getTradeReviewStatus(trade) === 'unreviewed').length}
			</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Missing Notes</div>
			<div class="mt-1 text-2xl font-semibold text-brand-300">
				{trades.filter((trade: any) => (trade.trade_notes || []).length === 0).length}
			</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Missing Attachments</div>
			<div class="mt-1 text-2xl font-semibold text-rose-300">
				{trades.filter((trade: any) => (trade.trade_attachments || []).length === 0).length}
			</div>
		</div>
	</div>

	<div class="flex items-center justify-between gap-3">
		<div class="text-sm text-gray-400">
			Page {currentPage}/{Math.max(totalPages, 1)}
		</div>
		<div class="flex items-center gap-2">
			<label for="group-by" class="text-xs text-gray-500">Group by</label>
			<select id="group-by" bind:value={groupBy} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
				<option value="none">None</option>
				<option value="day">Day</option>
				<option value="session">Session</option>
				<option value="setup">Setup / Playbook</option>
			</select>
		</div>
	</div>

	{#if trades.length === 0}
		<div class="card">
			<EmptyState message="ไม่พบ trade ตาม filter ที่เลือก" />
		</div>
	{:else}
		<div class="space-y-4">
			{#each groupedTrades as group}
				<div class="card">
					<div class="flex items-center justify-between gap-3 mb-4">
						<h3 class="text-sm font-medium text-white">{group.label}</h3>
						<span class="text-xs text-gray-500">{group.items.length} trades</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-dark-border text-gray-500 text-xs">
									<th class="text-left py-2">Trade</th>
									<th class="text-left py-2">Review</th>
									<th class="text-left py-2">Playbook</th>
									<th class="text-left py-2">Tags</th>
									<th class="text-center py-2">Notes</th>
									<th class="text-center py-2">Files</th>
									<th class="text-center py-2">Insights</th>
									<th class="text-center py-2">Quality</th>
									<th class="text-center py-2">R</th>
									<th class="text-right py-2">P/L</th>
									<th class="text-right py-2">Time</th>
								</tr>
							</thead>
							<tbody>
								{#each group.items as trade}
									<tr
										class="border-b border-dark-border/40 hover:bg-dark-border/20 cursor-pointer"
										onclick={() => goto(`/portfolio/trades/${trade.id}`)}
									>
										<td class="py-3">
											<div class="font-medium text-white">{trade.symbol}</div>
											<div class="text-[11px] text-gray-500">
												{trade.type} • {trade.lot_size} lots • {formatNumber(trade.open_price, 5)} → {formatNumber(trade.close_price, 5)}
											</div>
										</td>
										<td class="py-3"><ReviewStatusBadge status={getTradeReviewStatus(trade)} /></td>
										<td class="py-3 text-gray-300">
											{playbooks.find((playbook: any) => playbook.id === getTradePlaybookId(trade))?.name || '-'}
										</td>
										<td class="py-3">
											<div class="flex flex-wrap gap-1">
												{#each (trade.trade_tag_assignments || []).slice(0, 3) as assignment}
													{#if assignment.trade_tags}
														<TagPill
															name={assignment.trade_tags.name}
															color={assignment.trade_tags.color}
															category={assignment.trade_tags.category}
														/>
													{/if}
												{/each}
											</div>
										</td>
										<td class="py-3 text-center text-gray-300">{(trade.trade_notes || []).length || '—'}</td>
										<td class="py-3 text-center text-gray-300">{(trade.trade_attachments || []).length || '—'}</td>
										<td class="py-3 text-center">
											{#if tradeInsights[trade.id]}
												{@const ins = tradeInsights[trade.id]}
												<InsightBadge
													count={ins.length}
													positive={ins.filter((i: any) => i.category === 'positive').length}
													negative={ins.filter((i: any) => i.category === 'negative').length}
												/>
											{/if}
										</td>
										<td class="py-3 text-center">
											{#if tradeScores[trade.id] !== undefined}
												<QualityScoreBar score={tradeScores[trade.id]} />
											{/if}
										</td>
										<td class="py-3 text-center">
										{#if tradeExecutionMetrics[trade.id]?.rMultiple != null}
											{@const r = tradeExecutionMetrics[trade.id].rMultiple}
											<span class="text-xs font-mono {r >= 1 ? 'text-green-400' : r >= 0 ? 'text-amber-400' : 'text-red-400'}">
												{r >= 0 ? '+' : ''}{r.toFixed(1)}R
											</span>
										{:else}
											<span class="text-xs text-gray-600">—</span>
										{/if}
									</td>
									<td class="py-3 text-right font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
											{formatCurrency(trade.profit)}
										</td>
										<td class="py-3 text-right text-gray-500">{formatDateTime(trade.close_time)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2">
				<button
					type="button"
					onclick={() => goToPage(currentPage - 1)}
					disabled={currentPage <= 1}
					class="px-3 py-1.5 text-sm rounded border border-dark-border text-gray-400 hover:text-white disabled:opacity-30"
				>
					← ก่อนหน้า
				</button>

				{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
					const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
					return start + i;
				}).filter((pageNumber) => pageNumber <= totalPages) as pageNumber}
					<button
						type="button"
						onclick={() => goToPage(pageNumber)}
						class="px-3 py-1.5 text-sm rounded border {pageNumber === currentPage ? 'border-brand-primary text-brand-primary' : 'border-dark-border text-gray-400 hover:text-white'}"
					>
						{pageNumber}
					</button>
				{/each}

				<button
					type="button"
					onclick={() => goToPage(currentPage + 1)}
					disabled={currentPage >= totalPages}
					class="px-3 py-1.5 text-sm rounded border border-dark-border text-gray-400 hover:text-white disabled:opacity-30"
				>
					ถัดไป →
				</button>
			</div>
		{/if}
	{/if}
</div>
