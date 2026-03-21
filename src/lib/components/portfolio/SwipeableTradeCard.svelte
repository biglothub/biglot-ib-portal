<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import InsightBadge from '$lib/components/portfolio/InsightBadge.svelte';
	import QualityScoreBar from '$lib/components/portfolio/QualityScoreBar.svelte';
	import { formatCurrency, formatDateTime, formatNumber } from '$lib/utils';
	import { getTradeReviewStatus, getTradePlaybookId } from '$lib/portfolio';
	import type { Trade, TradeTag, Playbook, ReviewStatus } from '$lib/types';
	import type { InsightResult } from '$lib/server/insights/types';

	interface Props {
		trade: Partial<Trade> & Record<string, unknown>;
		tags: TradeTag[];
		playbooks: Playbook[];
		insights?: InsightResult[];
		score?: number;
		selected?: boolean;
		onToggleSelect?: () => void;
	}

	let { trade, tags, playbooks, insights = [], score, selected = false, onToggleSelect }: Props =
		$props();

	// --- Swipe state ---
	let swipeX = $state(0);
	const THRESHOLD = 72;
	const MAX_X = 90;

	// --- Quick-action sheets ---
	let showReviewSheet = $state(false);
	let showTagSheet = $state(false);
	let quickReviewStatus = $state<ReviewStatus | ''>('');
	let quickTagId = $state('');
	let saving = $state(false);
	let errorMsg = $state('');

	// --- Derived ---
	const reviewStatus = $derived(getTradeReviewStatus(trade));
	const playbookName = $derived(
		playbooks.find((p) => p.id === getTradePlaybookId(trade))?.name ?? ''
	);

	// --- Svelte action: non-passive touchmove for horizontal swipe ---
	function swipeAction(node: HTMLElement) {
		let startX = 0;
		let startY = 0;
		let dirLocked: 'h' | 'v' | null = null;

		function onStart(e: TouchEvent) {
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
			dirLocked = null;
		}

		function onMove(e: TouchEvent) {
			const dx = e.touches[0].clientX - startX;
			const dy = e.touches[0].clientY - startY;

			if (dirLocked === null) {
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
				dirLocked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
			}
			if (dirLocked === 'v') return;

			e.preventDefault();
			swipeX = Math.max(-MAX_X, Math.min(MAX_X, dx));
		}

		function onEnd() {
			if (dirLocked !== 'h') {
				swipeX = 0;
				return;
			}
			if (swipeX <= -THRESHOLD) {
				showReviewSheet = true;
				quickReviewStatus = '';
				errorMsg = '';
			} else if (swipeX >= THRESHOLD) {
				showTagSheet = true;
				quickTagId = '';
				errorMsg = '';
			}
			swipeX = 0;
		}

		node.addEventListener('touchstart', onStart, { passive: true });
		node.addEventListener('touchmove', onMove, { passive: false });
		node.addEventListener('touchend', onEnd, { passive: true });

		return {
			destroy() {
				node.removeEventListener('touchstart', onStart);
				node.removeEventListener('touchmove', onMove);
				node.removeEventListener('touchend', onEnd);
			}
		};
	}

	// --- Quick Review ---
	async function applyQuickReview() {
		if (!quickReviewStatus) {
			errorMsg = 'กรุณาเลือกสถานะ';
			return;
		}
		saving = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/portfolio/trades/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					trade_ids: [trade.id],
					action: 'review_status',
					payload: { review_status: quickReviewStatus }
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				errorMsg = (err as { message?: string }).message ?? 'เกิดข้อผิดพลาด';
				return;
			}
			showReviewSheet = false;
			await invalidate('portfolio:baseData');
		} catch {
			errorMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			saving = false;
		}
	}

	// --- Quick Tag ---
	async function applyQuickTag() {
		if (!quickTagId) {
			errorMsg = 'กรุณาเลือก Tag';
			return;
		}
		saving = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/portfolio/trades/bulk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					trade_ids: [trade.id],
					action: 'tag',
					payload: { tag_id: quickTagId }
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				errorMsg = (err as { message?: string }).message ?? 'เกิดข้อผิดพลาด';
				return;
			}
			showTagSheet = false;
			await invalidate('portfolio:baseData');
		} catch {
			errorMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			saving = false;
		}
	}

	const isBuy = $derived((trade.type as string)?.toUpperCase().includes('BUY'));
	const swipeHint = $derived(
		swipeX <= -24 ? 'review' : swipeX >= 24 ? 'tag' : ''
	);
</script>

<!-- Swipeable container -->
<div class="relative overflow-hidden rounded-lg">
	<!-- Left action panel: Add Tag (revealed by right swipe) -->
	<div
		class="absolute inset-y-0 left-0 flex items-center justify-center w-[90px] bg-brand-primary/15 border border-brand-primary/30 rounded-l-lg"
		aria-hidden="true"
	>
		<div class="flex flex-col items-center gap-1 text-brand-primary">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
				/>
			</svg>
			<span class="text-xs font-medium">เพิ่ม Tag</span>
		</div>
	</div>

	<!-- Right action panel: Quick Review (revealed by left swipe) -->
	<div
		class="absolute inset-y-0 right-0 flex items-center justify-center w-[90px] bg-amber-500/15 border border-amber-500/30 rounded-r-lg"
		aria-hidden="true"
	>
		<div class="flex flex-col items-center gap-1 text-amber-400">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span class="text-xs font-medium">Review</span>
		</div>
	</div>

	<!-- Card content — moves horizontally with swipe -->
	<div
		use:swipeAction
		class="relative bg-dark-surface border border-dark-border rounded-lg p-4 select-none"
		style:transform="translateX({swipeX}px)"
		style:transition={swipeX === 0 ? 'transform 0.2s ease' : 'none'}
		role="button"
		tabindex="0"
		aria-label="ดูรายละเอียด {trade.symbol} กำไร/ขาดทุน {formatCurrency(trade.profit as number)}"
		onclick={() => goto(`/portfolio/trades/${trade.id}`)}
		onkeydown={(e) => e.key === 'Enter' && goto(`/portfolio/trades/${trade.id as string}`)}
	>
		<!-- Row 1: Symbol + P/L -->
		<div class="flex items-center justify-between mb-2">
			<div class="flex items-center gap-2.5">
				<!-- Checkbox — stops card click -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					role="checkbox"
					aria-checked={selected}
					tabindex="0"
					onclick={(e) => {
						e.stopPropagation();
						onToggleSelect?.();
					}}
					onkeydown={(e) => {
						if (e.key === ' ') {
							e.stopPropagation();
							onToggleSelect?.();
						}
					}}
					class="flex-shrink-0"
				>
					<input
						type="checkbox"
						checked={selected}
						onclick={(e) => e.stopPropagation()}
						class="w-5 h-5 rounded border-dark-border bg-dark-bg accent-brand-primary cursor-pointer pointer-events-none"
						aria-hidden="true"
					/>
				</div>

				<div>
					<span class="font-bold text-white text-base leading-tight">{trade.symbol}</span>
					<span
						class="ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold {isBuy
							? 'bg-green-900/40 text-green-400'
							: 'bg-red-900/40 text-red-400'}"
					>
						{isBuy ? 'BUY' : 'SELL'}
					</span>
				</div>
			</div>

			<span
				class="font-bold text-lg tabular-nums {(trade.profit as number) >= 0
					? 'text-green-400'
					: 'text-red-400'}"
			>
				{formatCurrency(trade.profit as number)}
			</span>
		</div>

		<!-- Row 2: Prices -->
		<div class="text-xs text-gray-500 mb-2.5 font-mono">
			{formatNumber(trade.open_price as number, 5)} → {formatNumber(trade.close_price as number, 5)}
			<span class="font-sans ml-1">• {trade.lot_size} lots</span>
		</div>

		<!-- Row 3: Status + Tags -->
		<div class="flex items-center gap-1.5 mb-2.5 flex-wrap">
			<ReviewStatusBadge status={reviewStatus} />
			{#each (trade.trade_tag_assignments ?? []).slice(0, 2) as assignment}
				{#if assignment.trade_tags}
					<TagPill
						name={assignment.trade_tags.name}
						color={assignment.trade_tags.color}
						category={assignment.trade_tags.category}
					/>
				{/if}
			{/each}
			{#if (trade.trade_tag_assignments ?? []).length > 2}
				<span class="text-[10px] text-gray-500">+{(trade.trade_tag_assignments ?? []).length - 2}</span>
			{/if}
			{#if playbookName}
				<span class="text-[10px] text-gray-500 italic">{playbookName}</span>
			{/if}
		</div>

		<!-- Row 4: Quality + Insights + Time -->
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-3">
				{#if score !== undefined}
					<div class="w-20">
						<QualityScoreBar {score} />
					</div>
				{/if}
				{#if insights.length > 0}
					<InsightBadge
						count={insights.length}
						positive={insights.filter((i) => i.category === 'positive').length}
						negative={insights.filter((i) => i.category === 'negative').length}
					/>
				{/if}
			</div>
			<span class="text-xs text-gray-600">{formatDateTime(trade.close_time as string)}</span>
		</div>

		<!-- Swipe hint indicator -->
		{#if swipeHint}
			<div
				class="absolute inset-0 rounded-lg pointer-events-none transition-opacity duration-100 {swipeHint === 'review'
					? 'border-2 border-amber-500/40'
					: 'border-2 border-brand-primary/40'}"
			></div>
		{/if}
	</div>
</div>

<!-- ─── Quick Review Bottom Sheet ─── -->
{#if showReviewSheet}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 bg-black/60 z-50"
		role="presentation"
		onclick={() => {
			showReviewSheet = false;
			errorMsg = '';
		}}
	></div>

	<!-- Sheet -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 bg-dark-surface border-t border-dark-border rounded-t-2xl p-5 space-y-4 pb-safe"
	>
		<!-- Handle bar -->
		<div class="flex justify-center mb-1">
			<div class="w-10 h-1 bg-dark-border rounded-full"></div>
		</div>

		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-semibold text-white">Quick Review</h3>
				<p class="text-xs text-gray-500 mt-0.5">{trade.symbol} • {formatCurrency(trade.profit as number)}</p>
			</div>
			<button
				type="button"
				onclick={() => {
					showReviewSheet = false;
					errorMsg = '';
				}}
				class="p-2 text-gray-400 hover:text-white rounded-lg"
				aria-label="ปิด"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="grid grid-cols-3 gap-2">
			{#each [
				{ value: 'unreviewed' as ReviewStatus, label: 'ยังไม่ Review', cls: 'border-gray-600 text-gray-400' },
				{ value: 'in_progress' as ReviewStatus, label: 'กำลังดำเนินการ', cls: 'border-amber-500/60 text-amber-400' },
				{ value: 'reviewed' as ReviewStatus, label: 'Review แล้ว', cls: 'border-green-500/60 text-green-400' }
			] as opt}
				<button
					type="button"
					onclick={() => (quickReviewStatus = opt.value)}
					class="py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all text-center leading-tight {quickReviewStatus === opt.value
						? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
						: opt.cls}"
				>
					{opt.label}
				</button>
			{/each}
		</div>

		{#if errorMsg}
			<p class="text-xs text-red-400">{errorMsg}</p>
		{/if}

		<button
			type="button"
			onclick={applyQuickReview}
			disabled={saving || !quickReviewStatus}
			class="w-full py-3.5 rounded-xl bg-brand-primary text-dark-bg font-bold text-sm disabled:opacity-40 active:opacity-80"
		>
			{saving ? 'กำลังบันทึก...' : 'บันทึกสถานะ'}
		</button>
	</div>
{/if}

<!-- ─── Quick Tag Bottom Sheet ─── -->
{#if showTagSheet}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="fixed inset-0 bg-black/60 z-50"
		role="presentation"
		onclick={() => {
			showTagSheet = false;
			errorMsg = '';
		}}
	></div>

	<!-- Sheet -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 bg-dark-surface border-t border-dark-border rounded-t-2xl p-5 space-y-4 pb-safe"
	>
		<!-- Handle bar -->
		<div class="flex justify-center mb-1">
			<div class="w-10 h-1 bg-dark-border rounded-full"></div>
		</div>

		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-semibold text-white">เพิ่ม Tag</h3>
				<p class="text-xs text-gray-500 mt-0.5">{trade.symbol} • {formatCurrency(trade.profit as number)}</p>
			</div>
			<button
				type="button"
				onclick={() => {
					showTagSheet = false;
					errorMsg = '';
				}}
				class="p-2 text-gray-400 hover:text-white rounded-lg"
				aria-label="ปิด"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		{#if tags.length === 0}
			<p class="text-sm text-gray-500 text-center py-6">
				ยังไม่มี Tag — สร้าง Tag ได้ที่หน้า Playbook
			</p>
		{:else}
			<div class="flex flex-wrap gap-2 max-h-52 overflow-y-auto py-1">
				{#each tags as tag}
					<button
						type="button"
						onclick={() => (quickTagId = tag.id)}
						class="px-3 py-1.5 rounded-full text-sm border-2 transition-all font-medium {quickTagId === tag.id
							? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
							: 'border-dark-border text-gray-400 hover:border-brand-primary/50 hover:text-gray-200'}"
					>
						{tag.name}
					</button>
				{/each}
			</div>
		{/if}

		{#if errorMsg}
			<p class="text-xs text-red-400">{errorMsg}</p>
		{/if}

		<button
			type="button"
			onclick={applyQuickTag}
			disabled={saving || !quickTagId || tags.length === 0}
			class="w-full py-3.5 rounded-xl bg-brand-primary text-dark-bg font-bold text-sm disabled:opacity-40 active:opacity-80"
		>
			{saving ? 'กำลังบันทึก...' : 'เพิ่ม Tag'}
		</button>
	</div>
{/if}
