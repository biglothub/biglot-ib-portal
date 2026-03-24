<script lang="ts">
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import { formatCurrency, formatDateTime } from '$lib/utils';
	import { getTradePlaybookId } from '$lib/portfolio';
	import type { Trade, Playbook, TradeTagAssignment } from '$lib/types';

	let { trades, playbooks = [], tradeScores = {}, tradeInsights = {}, onclose, onremove }: {
		trades: Trade[];
		playbooks?: Playbook[];
		tradeScores?: Record<string, number>;
		tradeInsights?: Record<string, { category: string }[]>;
		onclose: () => void;
		onremove: (id: string) => void;
	} = $props();

	function formatDuration(openTime: string | null | undefined, closeTime: string | null | undefined): string {
		if (!openTime || !closeTime) return '—';
		const diffMs = new Date(closeTime).getTime() - new Date(openTime).getTime();
		if (diffMs <= 0) return '—';
		const totalMinutes = Math.floor(diffMs / 60000);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	}

	function getPlaybookName(trade: Trade): string {
		const id = getTradePlaybookId(trade);
		if (!id) return '—';
		return playbooks.find((p) => p.id === id)?.name ?? '—';
	}

	function getRuleBreakCount(trade: Trade): number {
		return trade.trade_reviews?.[0]?.broken_rules?.length ?? 0;
	}

	function getQualityScore(tradeId: string): number | null {
		return tradeScores[tradeId] ?? null;
	}

	function getQualityColor(score: number): string {
		if (score >= 70) return 'bg-green-500';
		if (score >= 50) return 'bg-amber-500';
		if (score >= 30) return 'bg-orange-500';
		return 'bg-red-500';
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-40 bg-black/40"
	role="presentation"
	onclick={onclose}
></div>

<!-- Panel -->
<div
	class="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-dark-surface border-l border-dark-border shadow-2xl"
	style="width: min(100vw, 680px);"
	role="dialog"
	aria-modal="true"
	aria-label="เปรียบเทียบเทรด"
>
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-dark-border shrink-0">
		<h2 class="text-sm font-semibold text-white">
			เปรียบเทียบเทรด
			<span class="ml-1 text-gray-400 font-normal">({trades.length}/4)</span>
		</h2>
		<button
			type="button"
			onclick={onclose}
			class="w-7 h-7 flex items-center justify-center rounded hover:bg-dark-border text-gray-400 hover:text-white transition-colors"
			aria-label="ปิด"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	{#if trades.length < 2}
		<!-- Empty state -->
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center text-gray-400">
				<svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
				<p class="text-sm">เลือกอย่างน้อย 2 เทรด</p>
				<p class="text-xs mt-1 opacity-60">เลือกเทรดจากตารางด้านซ้ายเพื่อเปรียบเทียบ</p>
			</div>
		</div>
	{:else}
		<!-- Comparison table — horizontal scroll on mobile -->
		<div class="flex-1 overflow-auto">
			<table class="w-full text-sm border-collapse" style="min-width: {trades.length * 160}px;">
				<!-- Trade header columns -->
				<thead class="sticky top-0 z-10 bg-dark-surface">
					<tr class="border-b border-dark-border">
						<!-- Row label column -->
						<th class="text-left py-3 px-3 w-28 shrink-0 text-xs text-gray-400 font-medium bg-dark-surface border-r border-dark-border/40">
							รายการ
						</th>
						{#each trades as trade (trade.id)}
							<th class="py-3 px-3 text-left font-normal bg-dark-surface">
								<div class="flex items-start justify-between gap-2">
									<div>
										<div class="font-semibold text-white text-sm">#{trade.position_id}</div>
										<div class="text-xs text-gray-400 mt-0.5">{trade.symbol}</div>
									</div>
									<button
										type="button"
										onclick={() => onremove(trade.id)}
										class="w-6 h-6 flex items-center justify-center rounded hover:bg-dark-border text-gray-500 hover:text-white transition-colors shrink-0 mt-0.5"
										aria-label="ลบ {trade.symbol} ออกจากการเปรียบเทียบ"
									>
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<!-- Symbol -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">สัญลักษณ์</td>
						{#each trades as trade (trade.id)}
							<td class="py-2.5 px-3 text-white font-medium">{trade.symbol}</td>
						{/each}
					</tr>

					<!-- Direction -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">ทิศทาง</td>
						{#each trades as trade (trade.id)}
							<td class="py-2.5 px-3">
								<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold {trade.type === 'BUY' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}">
									{trade.type}
								</span>
							</td>
						{/each}
					</tr>

					<!-- P&L -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">กำไร/ขาดทุน</td>
						{#each trades as trade (trade.id)}
							<td class="py-2.5 px-3 font-semibold {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
								{formatCurrency(trade.profit)}
							</td>
						{/each}
					</tr>

					<!-- Duration -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">ระยะเวลา</td>
						{#each trades as trade (trade.id)}
							<td class="py-2.5 px-3 text-gray-300">{formatDuration(trade.open_time, trade.close_time)}</td>
						{/each}
					</tr>

					<!-- Open Time -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">เปิด</td>
						{#each trades as trade (trade.id)}
							<td class="py-2.5 px-3 text-gray-300 text-xs">{formatDateTime(trade.open_time)}</td>
						{/each}
					</tr>

					<!-- Lots -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">Lots</td>
						{#each trades as trade (trade.id)}
							<td class="py-2.5 px-3 text-gray-300">{trade.lot_size}</td>
						{/each}
					</tr>

					<!-- Playbook -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">Playbook</td>
						{#each trades as trade (trade.id)}
							<td class="py-2.5 px-3 text-gray-300 text-xs">{getPlaybookName(trade)}</td>
						{/each}
					</tr>

					<!-- Quality Score -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">คุณภาพ</td>
						{#each trades as trade (trade.id)}
							{@const score = getQualityScore(trade.id)}
							<td class="py-2.5 px-3">
								{#if score !== null}
									<div class="flex items-center gap-1.5">
										<div class="w-14 h-1.5 rounded-full bg-dark-border overflow-hidden">
											<div
												class="{getQualityColor(score)} h-full rounded-full transition-all"
												style="width: {score}%"
											></div>
										</div>
										<span class="text-[11px] text-gray-400">{score}</span>
									</div>
								{:else}
									<span class="text-xs text-gray-500">—</span>
								{/if}
							</td>
						{/each}
					</tr>

					<!-- Tags -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">แท็ก</td>
						{#each trades as trade (trade.id)}
							<td class="py-2.5 px-3">
								<div class="flex flex-wrap gap-1">
									{#each (trade.trade_tag_assignments || []).slice(0, 3) as assignment (assignment.id)}
										{#if assignment.trade_tags}
											<TagPill
												name={assignment.trade_tags.name}
												color={assignment.trade_tags.color}
												category={assignment.trade_tags.category}
											/>
										{/if}
									{/each}
									{#if (trade.trade_tag_assignments || []).length === 0}
										<span class="text-xs text-gray-500">—</span>
									{/if}
								</div>
							</td>
						{/each}
					</tr>

					<!-- Rule Breaks -->
					<tr class="border-b border-dark-border/30">
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">ละเมิดกฎ</td>
						{#each trades as trade (trade.id)}
							{@const breaks = getRuleBreakCount(trade)}
							<td class="py-2.5 px-3">
								{#if breaks > 0}
									<span class="text-xs font-medium text-red-400">{breaks} breaks</span>
								{:else if trade.trade_reviews?.length}
									<span class="text-xs text-green-400">0 breaks</span>
								{:else}
									<span class="text-xs text-gray-500">—</span>
								{/if}
							</td>
						{/each}
					</tr>

					<!-- Insights -->
					<tr>
						<td class="py-2.5 px-3 text-xs text-gray-400 border-r border-dark-border/40 bg-dark-bg/30">Insights</td>
						{#each trades as trade (trade.id)}
							{@const ins = tradeInsights[trade.id]}
							<td class="py-2.5 px-3">
								{#if ins && ins.length > 0}
									{@const pos = ins.filter((i) => i.category === 'positive').length}
									{@const neg = ins.filter((i) => i.category === 'negative').length}
									<div class="flex items-center gap-1">
										{#if pos > 0}
											<span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">{pos}</span>
										{/if}
										{#if neg > 0}
											<span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">{neg}</span>
										{/if}
									</div>
								{:else}
									<span class="text-xs text-gray-500">—</span>
								{/if}
							</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Footer hint for max trades -->
		{#if trades.length >= 4}
			<div class="px-4 py-2 text-center text-xs text-gray-500 border-t border-dark-border/40 shrink-0">
				เลือกได้สูงสุด 4 เทรด — ลบเทรดออกก่อนเพิ่มใหม่
			</div>
		{/if}
	{/if}
</div>
