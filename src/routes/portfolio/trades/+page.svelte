<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import InsightBadge from '$lib/components/portfolio/InsightBadge.svelte';
	import QualityScoreBar from '$lib/components/portfolio/QualityScoreBar.svelte';
	import TradeProfitBadge from '$lib/components/portfolio/TradeProfitBadge.svelte';
	import { formatCurrency, formatDateTime, formatNumber } from '$lib/utils';
	import { getTradePlaybookId, getTradeReviewStatus, getTradeSession } from '$lib/portfolio';
	import type { Trade, TradeTagAssignment, Playbook } from '$lib/types';
	import TradeImportModal from '$lib/components/portfolio/TradeImportModal.svelte';
	import SwipeableTradeCard from '$lib/components/portfolio/SwipeableTradeCard.svelte';
	import VirtualList from '$lib/components/shared/VirtualList.svelte';
	import TradeComparePanel from '$lib/components/portfolio/TradeComparePanel.svelte';
	import TradeKpiHeader from '$lib/components/portfolio/TradeKpiHeader.svelte';

	let { data } = $props();
	let trades = $derived(data.trades || []);
	let total = $derived(data.total || 0);
	let kpiMetrics = $derived(data.kpiMetrics);
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
	let showImportModal = $state(false);
	let exportLoading = $state(false);
	let comparePanelOpen = $state(false);

	function openCompare() {
		comparePanelOpen = true;
	}

	function removeFromCompare(id: string) {
		const next = new Set(selectedIds);
		next.delete(id);
		selectedIds = next;
		if (next.size < 2) comparePanelOpen = false;
	}
	const totalPages = $derived(Math.ceil(total / pageSize));

	// --- Bulk selection state ---
	let selectedIds = $state<Set<string>>(new Set());
	let bulkAction = $state<'tag' | 'review_status' | 'export' | ''>('');
	let bulkTagId = $state('');
	let bulkReviewStatus = $state('');
	let bulkLoading = $state(false);
	let bulkError = $state('');

	const selectionCount = $derived(selectedIds.size);

	function toggleTrade(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function isGroupAllSelected(items: Trade[]) {
		return items.length > 0 && items.every((t) => selectedIds.has(t.id));
	}

	function toggleGroupAll(items: Trade[]) {
		const next = new Set(selectedIds);
		if (isGroupAllSelected(items)) {
			items.forEach((t) => next.delete(t.id));
		} else {
			items.forEach((t) => next.add(t.id));
		}
		selectedIds = next;
	}

	function clearSelection() {
		selectedIds = new Set();
		bulkAction = '';
		bulkTagId = '';
		bulkReviewStatus = '';
		bulkError = '';
	}

	async function applyBulkAction() {
		if (selectionCount === 0) return;
		if (bulkAction === 'tag' && !bulkTagId) {
			bulkError = 'กรุณาเลือก Tag';
			return;
		}
		if (bulkAction === 'review_status' && !bulkReviewStatus) {
			bulkError = 'กรุณาเลือกสถานะ';
			return;
		}

		bulkLoading = true;
		bulkError = '';

		try {
			const res = await fetch('/api/portfolio/trades/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					trade_ids: Array.from(selectedIds),
					action: bulkAction,
					payload: bulkAction === 'tag' ? { tag_id: bulkTagId } : { review_status: bulkReviewStatus }
				})
			});

			if (!res.ok) {
				const err = await res.json();
				bulkError = err.message || 'เกิดข้อผิดพลาด';
				return;
			}

			clearSelection();
			await invalidate('portfolio:baseData');
		} catch {
			bulkError = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			bulkLoading = false;
		}
	}

	function exportSelectedCsv() {
		const selected = trades.filter((t: Trade) => selectedIds.has(t.id));
		if (selected.length === 0) return;

		const header = ['Symbol', 'Type', 'Lots', 'Open Price', 'Close Price', 'Profit', 'Close Time', 'Review Status', 'Tags'];
		const rows = selected.map((t: Trade) => [
			t.symbol,
			t.type,
			t.lot_size,
			t.open_price,
			t.close_price,
			t.profit,
			t.close_time,
			getTradeReviewStatus(t),
			(t.trade_tag_assignments || []).map((a: TradeTagAssignment) => a.trade_tags?.name).filter(Boolean).join('|')
		]);

		const csv = [header, ...rows]
			.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
			.join('\n');

		const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `trades_export_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function exportAllCsv() {
		exportLoading = true;
		try {
			const params = new URLSearchParams(window.location.search);
			const from = params.get('from') || '';
			const to = params.get('to') || '';
			const exportParams = new URLSearchParams();
			if (from) exportParams.set('from', from);
			if (to) exportParams.set('to', to);

			const res = await fetch(`/api/portfolio/trades/export?${exportParams.toString()}`);
			if (!res.ok) return;

			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `trades_export_${new Date().toISOString().slice(0, 10)}.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exportLoading = false;
		}
	}

	function goToPage(pageNumber: number) {
		const params = new URLSearchParams(window.location.search);
		params.set('page', String(pageNumber));
		goto(`/portfolio/trades?${params.toString()}`);
	}

	function handleRowKeydown(e: KeyboardEvent, tradeId: string) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			goto(`/portfolio/trades/${tradeId}`);
		}
	}

	// Pre-compute stats once (avoid triple-filtering in template)
	const quickStats = $derived.by(() => {
		let unreviewed = 0, noNotes = 0, noAttachments = 0;
		for (const t of trades) {
			if (getTradeReviewStatus(t) === 'unreviewed') unreviewed++;
			if (!t.trade_notes || t.trade_notes.length === 0) noNotes++;
			if (!t.trade_attachments || t.trade_attachments.length === 0) noAttachments++;
		}
		return { unreviewed, noNotes, noAttachments };
	});

	// Build playbook lookup Map once (O(1) per trade instead of .find())
	const playbookMap = $derived(new Map(playbooks.map((p: Playbook) => [p.id, p.name])));

	// Cached Thai date formatter (avoid creating Intl objects per trade)
	const thaiDayFmt = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });

	const groupedTrades = $derived.by(() => {
		if (groupBy === 'none') {
			return [{ label: 'เทรดทั้งหมด', items: trades }];
		}

		const groups = new Map<string, any[]>();
		for (const trade of trades) {
			let label: string;
			if (groupBy === 'day') {
				label = thaiDayFmt.format(new Date(trade.close_time || Date.now()));
			} else if (groupBy === 'session') {
				label = getTradeSession(trade.close_time).toUpperCase();
			} else {
				const pbId = getTradePlaybookId(trade);
				label = (pbId && playbookMap.get(pbId)) ||
					(trade.trade_tag_assignments || []).find((a: TradeTagAssignment) => a.trade_tags?.category === 'setup')?.trade_tags?.name ||
					'ไม่มี Setup';
			}

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

	<!-- Import / Export buttons -->
	<div class="flex items-center justify-end gap-2">
		<button
			type="button"
			onclick={() => showImportModal = true}
			class="px-3 py-1.5 text-sm rounded border border-dark-border text-gray-300 hover:text-white hover:border-brand-primary/50 flex items-center gap-1.5"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
			นำเข้า CSV
		</button>
		<button
			type="button"
			onclick={exportAllCsv}
			disabled={exportLoading}
			class="px-3 py-1.5 text-sm rounded border border-dark-border text-gray-300 hover:text-white hover:border-brand-primary/50 flex items-center gap-1.5 disabled:opacity-50"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
			{exportLoading ? 'กำลังดาวน์โหลด...' : 'ส่งออก CSV'}
		</button>
	</div>

	<!-- KPI Header (Tradezella style) -->
	{#if kpiMetrics}
		<TradeKpiHeader {kpiMetrics} />
	{/if}

	<!-- Quick stats (compact) -->
	<div class="flex flex-wrap items-center gap-4 text-xs text-gray-400">
		<span>{total} เทรดที่กรอง</span>
		{#if quickStats.unreviewed > 0}
			<span class="text-amber-400">{quickStats.unreviewed} ยังไม่ review</span>
		{/if}
		{#if quickStats.noNotes > 0}
			<span>{quickStats.noNotes} ไม่มี notes</span>
		{/if}
		{#if quickStats.noAttachments > 0}
			<span>{quickStats.noAttachments} ไม่มีไฟล์แนบ</span>
		{/if}
	</div>

	<!-- Bulk action bar -->
	{#if selectionCount > 0}
		<div class="sticky top-0 z-20 bg-dark-surface border border-brand-primary/40 rounded-lg px-4 py-3 flex flex-wrap items-center gap-3 shadow-lg">
			<span class="text-sm font-medium text-brand-primary">เลือกแล้ว {selectionCount} trade</span>

			<div class="flex items-center gap-2 flex-wrap flex-1">
				<!-- Action picker -->
				<select
					bind:value={bulkAction}
					class="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-sm text-white"
				>
					<option value="">-- เลือก action --</option>
					<option value="tag">เพิ่ม Tag</option>
					<option value="review_status">เปลี่ยนสถานะ Review</option>
					<option value="export">ส่งออก CSV</option>
				</select>

				{#if bulkAction === 'tag'}
					<select
						bind:value={bulkTagId}
						class="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-sm text-white"
					>
						<option value="">-- เลือก Tag --</option>
						{#each tags as tag}
							<option value={tag.id}>{tag.name} ({tag.category})</option>
						{/each}
					</select>
				{/if}

				{#if bulkAction === 'review_status'}
					<select
						bind:value={bulkReviewStatus}
						class="bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-sm text-white"
					>
						<option value="">-- เลือกสถานะ --</option>
						<option value="unreviewed">ยังไม่ Review</option>
						<option value="in_progress">กำลังดำเนินการ</option>
						<option value="reviewed">Review แล้ว</option>
					</select>
				{/if}

				{#if bulkAction === 'export'}
					<button
						type="button"
						onclick={exportSelectedCsv}
						class="px-4 py-1.5 text-sm rounded bg-brand-primary text-dark-bg font-medium hover:bg-brand-primary/80"
					>
						ดาวน์โหลด CSV
					</button>
				{:else if bulkAction}
					<button
						type="button"
						onclick={applyBulkAction}
						disabled={bulkLoading}
						class="px-4 py-1.5 text-sm rounded bg-brand-primary text-dark-bg font-medium hover:bg-brand-primary/80 disabled:opacity-50"
					>
						{bulkLoading ? 'กำลังบันทึก...' : 'บันทึก'}
					</button>
				{/if}

				{#if bulkError}
					<span class="text-xs text-red-400">{bulkError}</span>
				{/if}
			</div>

		<!-- Compare button: visible when 2–4 trades selected -->
		{#if selectionCount >= 2 && selectionCount <= 4}
			<button
				type="button"
				onclick={openCompare}
				class="px-4 py-1.5 text-sm rounded border border-brand-primary/60 text-brand-primary hover:bg-brand-primary/10 font-medium flex items-center gap-1.5 transition-colors"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
				เปรียบเทียบ ({selectionCount})
			</button>
		{/if}

			<button
				type="button"
				onclick={clearSelection}
				class="text-xs text-gray-400 hover:text-white ml-auto"
			>
				ยกเลิกการเลือก
			</button>
		</div>
	{/if}

	<div class="flex items-center justify-between gap-3">
		<div class="text-sm text-gray-400">
			หน้า {currentPage}/{Math.max(totalPages, 1)}
		</div>
		<div class="flex items-center gap-2">
			<label for="group-by" class="text-xs text-gray-400">จัดกลุ่มตาม</label>
			<select id="group-by" bind:value={groupBy} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
				<option value="none">ไม่จัดกลุ่ม</option>
				<option value="day">วัน</option>
				<option value="session">เซสชัน</option>
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
						<div class="flex items-center gap-3">
							<!-- Group select-all checkbox -->
							<input
								type="checkbox"
								checked={isGroupAllSelected(group.items)}
								onchange={() => toggleGroupAll(group.items)}
								class="w-4 h-4 rounded border-dark-border bg-dark-bg accent-brand-primary cursor-pointer"
								aria-label="เลือก trade ทั้งหมดในกลุ่มนี้"
							/>
							<h3 class="text-sm font-medium text-white">{group.label}</h3>
						</div>
						<span class="text-xs text-gray-400">{group.items.length} เทรด</span>
					</div>
					<!-- Mobile card list (hidden on md+) — virtual scrolled for large groups -->
				{#if group.items.length > 10}
					<div class="md:hidden mb-2" style:height="{Math.min(group.items.length, 6) * 120}px">
						<VirtualList items={group.items} itemHeight={120} overscan={3}>
							{#snippet item(trade)}
								<div class="pb-2">
									<SwipeableTradeCard
										{trade}
										{tags}
										{playbooks}
										insights={tradeInsights[trade.id]}
										score={tradeScores[trade.id]}
										selected={selectedIds.has(trade.id)}
										onToggleSelect={() => toggleTrade(trade.id)}
									/>
								</div>
							{/snippet}
						</VirtualList>
					</div>
				{:else}
					<div class="md:hidden space-y-2 mb-2">
						{#each group.items as trade}
							<SwipeableTradeCard
								{trade}
								{tags}
								{playbooks}
								insights={tradeInsights[trade.id]}
								score={tradeScores[trade.id]}
								selected={selectedIds.has(trade.id)}
								onToggleSelect={() => toggleTrade(trade.id)}
							/>
						{/each}
					</div>
				{/if}

				<!-- Desktop table (hidden on mobile) -->
				<div class="hidden md:block overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-700/50 text-gray-400 text-xs">
									<th class="w-8 py-2"></th>
									<th class="text-left py-2">เทรด</th>
									<th class="text-left py-2 whitespace-nowrap">สถานะ</th>
									<th class="text-left py-2">รีวิว</th>
									<th class="text-left py-2">Playbook</th>
									<th class="text-left py-2">แท็ก</th>
									<th class="text-center py-2">โน้ต</th>
									<th class="text-center py-2">ไฟล์</th>
									<th class="text-center py-2">Insights</th>
									<th class="text-center py-2">คุณภาพ</th>
									<th class="text-center py-2">R</th>
									<th class="text-right py-2">ROI</th>
									<th class="text-right py-2">กำไร/ขาดทุน</th>
									<th class="text-right py-2">เวลา</th>
								</tr>
							</thead>
							<tbody>
								{#each group.items as trade}
									<tr
										tabindex="0"
										role="link"
										aria-label="ดูรายละเอียด trade {trade.symbol} กำไร {formatCurrency(trade.profit)}"
										class="border-b border-gray-700/30 hover:bg-gray-700/20 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 focus-visible:ring-offset-dark-bg rounded {selectedIds.has(trade.id) ? 'bg-brand-primary/5' : ''}"
										onclick={(e) => {
											const target = e.target as HTMLElement;
											if (target.closest('input[type="checkbox"]') || target.closest('td.checkbox-cell')) return;
											goto(`/portfolio/trades/${trade.id}`);
										}}
										onkeydown={(e) => handleRowKeydown(e, trade.id)}
									>
										<!-- Checkbox cell — stops row click propagation -->
										<td class="py-2.5 pr-2 checkbox-cell" onclick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedIds.has(trade.id)}
												onchange={() => toggleTrade(trade.id)}
												class="w-4 h-4 rounded border-dark-border bg-dark-bg accent-brand-primary cursor-pointer"
												aria-label="เลือก trade {trade.symbol}"
											/>
										</td>
										<td class="py-2.5">
											<div class="font-medium text-white">{trade.symbol}</div>
											<div class="text-[11px] text-gray-400">
												{trade.type} • {trade.lot_size} lots • {formatNumber(trade.open_price, 5)} → {formatNumber(trade.close_price, 5)}
											</div>
										</td>
										<td class="py-2.5">
											<TradeProfitBadge profit={trade.profit} />
										</td>
										<td class="py-2.5">
											<ReviewStatusBadge status={getTradeReviewStatus(trade)} />
										</td>
										<td class="py-2.5 text-gray-300">
											{playbooks.find((playbook: Playbook) => playbook.id === getTradePlaybookId(trade))?.name || '-'}
										</td>
										<td class="py-2.5">
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
										<td class="py-2.5 text-center text-gray-300">
											{(trade.trade_notes || []).length || '—'}
										</td>
										<td class="py-2.5 text-center text-gray-300">
											{(trade.trade_attachments || []).length || '—'}
										</td>
										<td class="py-2.5 text-center">
											{#if tradeInsights[trade.id]}
												{@const ins = tradeInsights[trade.id]}
												<InsightBadge
													count={ins.length}
													positive={ins.filter((i: { category: string }) => i.category === 'positive').length}
													negative={ins.filter((i: { category: string }) => i.category === 'negative').length}
												/>
											{:else}
												<span class="text-xs text-gray-400">—</span>
											{/if}
										</td>
										<td class="py-2.5 text-center">
											{#if tradeScores[trade.id] !== undefined}
												<QualityScoreBar score={tradeScores[trade.id]} />
											{:else}
												<span class="text-xs text-gray-400">—</span>
											{/if}
										</td>
										<td class="py-2.5 text-center">
											{#if tradeExecutionMetrics[trade.id]?.rMultiple != null}
												{@const r = tradeExecutionMetrics[trade.id].rMultiple}
												<span class="text-xs font-mono {r >= 1 ? 'text-green-400' : r >= 0 ? 'text-amber-400' : 'text-red-400'}">
													{r >= 0 ? '+' : ''}{r.toFixed(1)}R
												</span>
											{:else}
												<span class="text-xs text-gray-400">—</span>
											{/if}
										</td>
										<td class="py-2.5 text-right">
											{#if tradeExecutionMetrics[trade.id]?.netRoi != null}
												{@const roi = tradeExecutionMetrics[trade.id].netRoi}
												<span class="text-xs font-mono {roi >= 0 ? 'text-green-400' : 'text-red-400'}">
													{roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
												</span>
											{:else}
												<span class="text-xs text-gray-400">—</span>
											{/if}
										</td>
										<td class="py-2.5 text-right font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
											{formatCurrency(trade.profit)}
										</td>
										<td class="py-2.5 text-right text-gray-400">
											{formatDateTime(trade.close_time)}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/each}
		</div>

		<!-- Count indicator -->
		<div class="text-center text-xs text-gray-400">
			แสดง {trades.length} จาก {total} รายการ
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

<TradeImportModal bind:open={showImportModal} />

{#if comparePanelOpen}
	{@const selectedTrades = trades.filter((t: Trade) => selectedIds.has(t.id))}
	<TradeComparePanel
		trades={selectedTrades}
		{playbooks}
		tradeScores={tradeScores}
		tradeInsights={tradeInsights}
		onclose={() => comparePanelOpen = false}
		onremove={removeFromCompare}
	/>
{/if}
