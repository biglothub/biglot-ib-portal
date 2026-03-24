<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import ScreenshotAnnotator from '$lib/components/portfolio/ScreenshotAnnotator.svelte';
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import ChecklistEditor from '$lib/components/portfolio/ChecklistEditor.svelte';
	import MultiTimeframeChart from '$lib/components/charts/MultiTimeframeChart.svelte';
	import InsightsSection from '$lib/components/portfolio/InsightsSection.svelte';
	import QualityScoreBar from '$lib/components/portfolio/QualityScoreBar.svelte';
	import ExecutionMetricsCard from '$lib/components/portfolio/ExecutionMetricsCard.svelte';
	import { formatCurrency, formatNumber, formatDateTime, toThaiDateString } from '$lib/utils';
	import type { TradeTagAssignment, TradeTag, Playbook } from '$lib/types';

	let { data } = $props();
	let { trade, relatedTrades, chartContexts, dayJournal, playbooks } = $derived(data);
	let similarReviewedTrades = $derived(data.similarReviewedTrades || []);
	let tags = $derived(data.tags || []);
	let insights = $derived(data.insights || []);
	let qualityScore = $derived(data.qualityScore || 0);
	let executionMetrics = $derived(data.executionMetrics || { plannedRisk: null, plannedReward: null, rMultiple: null, executionEfficiency: null });

	let noteContent = $state('');
	let noteRating = $state<number | null>(null);
	let savingNote = $state(false);
	let noteSaved = $state(false);

	let showTagDropdown = $state(false);
	let assigningTag = $state(false);

	let reviewStatus = $state<'unreviewed' | 'in_progress' | 'reviewed'>('unreviewed');
	let selectedPlaybookId = $state('');
	let entryReason = $state('');
	let exitReason = $state('');
	let executionNotes = $state('');
	let riskNotes = $state('');
	let mistakeSummary = $state('');
	let lessonSummary = $state('');
	let nextAction = $state('');
	let setupQuality = $state<number | null>(null);
	let disciplineScore = $state<number | null>(null);
	let executionScore = $state<number | null>(null);
	let confidenceAtEntry = $state<number | null>(null);
	let followedPlan = $state<string>('');
	let brokenRules = $state<string[]>([]);
	let savingReview = $state(false);
	let reviewSaved = $state(false);

	let attachments = $state<any[]>([]);
	let showAnnotator = $state(false);
	let showReplay = $state(false);
	let TradeReplayChart = $state<any>(null);

	async function openReplay() {
		if (!TradeReplayChart) {
			TradeReplayChart = (await import('$lib/components/portfolio/TradeReplayChart.svelte')).default;
		}
		showReplay = true;
	}
	let attachmentKind = $state<'link' | 'image_url'>('link');
	let attachmentPath = $state('');
	let attachmentCaption = $state('');
	let savingAttachment = $state(false);
	let actionError = $state('');

	// Optimistic tag state
	let optimisticAddedTags = $state<any[]>([]);
	let optimisticRemovedTagIds = $state<Set<string>>(new Set());
	let lastSyncedTradeId = $state('');

	const effectiveAssignments = $derived.by(() => {
		const real = (trade?.trade_tag_assignments || [])
			.filter((a: TradeTagAssignment) => !optimisticRemovedTagIds.has(a.tag_id));
		return [...real, ...optimisticAddedTags];
	});
	const assignedTagIds = $derived(
		new Set(effectiveAssignments.map((a: TradeTagAssignment) => a.tag_id))
	);
	const availableTags = $derived(tags.filter((tag: TradeTag) => !assignedTagIds.has(tag.id)));
	const review = $derived(trade?.trade_reviews?.[0] || null);
	const journalDate = $derived(
		trade ? toThaiDateString(trade.close_time) : ''
	);

	$effect(() => {
		const tradeId = trade?.id || '';
		const isNewTrade = tradeId !== lastSyncedTradeId;

		noteContent = trade?.trade_notes?.[0]?.content || '';
		noteRating = trade?.trade_notes?.[0]?.rating || null;
		reviewStatus = review?.review_status || 'unreviewed';
		selectedPlaybookId = review?.playbook_id || '';
		entryReason = review?.entry_reason || '';
		exitReason = review?.exit_reason || '';
		executionNotes = review?.execution_notes || '';
		riskNotes = review?.risk_notes || '';
		mistakeSummary = review?.mistake_summary || '';
		lessonSummary = review?.lesson_summary || '';
		nextAction = review?.next_action || '';
		setupQuality = review?.setup_quality_score || null;
		disciplineScore = review?.discipline_score || null;
		executionScore = review?.execution_score || null;
		confidenceAtEntry = review?.confidence_at_entry || null;
		followedPlan = review?.followed_plan == null ? '' : review.followed_plan ? 'yes' : 'no';
		brokenRules = review?.broken_rules || [];
		attachments = trade?.trade_attachments || [];

		// Only reset optimistic state when navigating to a different trade
		if (isNewTrade) {
			lastSyncedTradeId = tradeId;
			optimisticAddedTags = [];
			optimisticRemovedTagIds = new Set();
		}
	});

	function getDuration(openTime: string, closeTime: string): string {
		const ms = new Date(closeTime).getTime() - new Date(openTime).getTime();
		const mins = Math.floor(ms / 60000);
		if (mins < 60) return `${mins} นาที`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours} ชม. ${mins % 60} นาที`;
		const days = Math.floor(hours / 24);
		return `${days} วัน ${hours % 24} ชม.`;
	}

	async function saveNote() {
		if (!trade) return;
		savingNote = true;
		noteSaved = true;
		actionError = '';

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/notes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: noteContent, rating: noteRating })
			});

			if (!res.ok) {
				noteSaved = false;
				actionError = 'ไม่สามารถบันทึก Note ได้';
			}
		} catch {
			noteSaved = false;
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			savingNote = false;
			if (noteSaved) setTimeout(() => (noteSaved = false), 2000);
		}
	}

	async function saveReview() {
		if (!trade) return;
		savingReview = true;
		reviewSaved = false;
		actionError = '';

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/review`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playbook_id: selectedPlaybookId || null,
					review_status: reviewStatus,
					entry_reason: entryReason,
					exit_reason: exitReason,
					execution_notes: executionNotes,
					risk_notes: riskNotes,
					mistake_summary: mistakeSummary,
					lesson_summary: lessonSummary,
					next_action: nextAction,
					setup_quality_score: setupQuality,
					discipline_score: disciplineScore,
					execution_score: executionScore,
					confidence_at_entry: confidenceAtEntry,
					followed_plan: followedPlan === '' ? null : followedPlan === 'yes',
					broken_rules: brokenRules
				})
			});

			if (res.ok) {
				reviewSaved = true;
				setTimeout(() => (reviewSaved = false), 2000);
				invalidate('portfolio:baseData');
			} else {
				actionError = 'ไม่สามารถบันทึก Review ได้';
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			savingReview = false;
		}
	}

	async function assignTag(tagId: string) {
		if (!trade) return;
		actionError = '';

		// Optimistic: show tag immediately
		const tag = tags.find((t: TradeTag) => t.id === tagId);
		if (tag) {
			optimisticAddedTags = [...optimisticAddedTags, {
				id: `optimistic-${tagId}`,
				tag_id: tagId,
				trade_tags: { id: tag.id, name: tag.name, color: tag.color, category: tag.category }
			}];
		}
		showTagDropdown = false;

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/tags`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tag_id: tagId })
			});
			if (!res.ok) {
				optimisticAddedTags = optimisticAddedTags.filter(a => a.tag_id !== tagId);
				actionError = 'ไม่สามารถเพิ่ม Tag ได้';
				return;
			}
			invalidate('portfolio:baseData');
		} catch {
			optimisticAddedTags = optimisticAddedTags.filter(a => a.tag_id !== tagId);
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		}
	}

	async function removeTag(tagId: string) {
		if (!trade) return;
		actionError = '';

		// Optimistic: hide tag immediately
		optimisticRemovedTagIds = new Set([...optimisticRemovedTagIds, tagId]);
		optimisticAddedTags = optimisticAddedTags.filter(a => a.tag_id !== tagId);

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/tags`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tag_id: tagId })
			});
			if (!res.ok) {
				optimisticRemovedTagIds = new Set([...optimisticRemovedTagIds].filter(id => id !== tagId));
				actionError = 'ไม่สามารถลบ Tag ได้';
				return;
			}
			invalidate('portfolio:baseData');
		} catch {
			optimisticRemovedTagIds = new Set([...optimisticRemovedTagIds].filter(id => id !== tagId));
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		}
	}

	async function saveAttachment() {
		if (!trade || !attachmentPath.trim()) return;
		savingAttachment = true;
		actionError = '';

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/attachments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kind: attachmentKind,
					storage_path: attachmentPath,
					caption: attachmentCaption,
					sort_order: attachments.length
				})
			});

			if (res.ok) {
				attachmentPath = '';
				attachmentCaption = '';
				invalidate('portfolio:baseData');
			} else {
				actionError = 'ไม่สามารถเพิ่ม Attachment ได้';
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			savingAttachment = false;
		}
	}

	async function deleteAttachment(id: string) {
		if (!trade) return;
		if (!confirm('ต้องการลบ attachment นี้ใช่ไหม?')) return;
		actionError = '';

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/attachments`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) {
				actionError = 'ไม่สามารถลบ Attachment ได้';
				return;
			}
			invalidate('portfolio:baseData');
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		}
	}
</script>

<div class="space-y-6">
	<button
		type="button"
		onclick={() => goto('/portfolio/trades')}
		class="text-sm text-gray-400 hover:text-white flex items-center gap-1"
	>
		← กลับไป Review Inbox
	</button>

	{#if actionError}
		<div class="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center justify-between">
			<span>{actionError}</span>
			<button type="button" onclick={() => actionError = ''} class="text-red-300 hover:text-red-200 text-xs">ปิด</button>
		</div>
	{/if}

	{#if !trade}
		<div class="card text-center py-12">
			<p class="text-gray-500">ไม่พบ Trade นี้</p>
		</div>
	{:else}
		<div class="card">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div class="flex items-center gap-3">
						<h2 class="text-2xl font-bold text-white">{trade.symbol}</h2>
						<span class="text-sm px-2 py-1 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
							{trade.type}
						</span>
						<ReviewStatusBadge status={reviewStatus} />
					</div>
					<p class="text-xs text-gray-500 mt-2">
						{formatDateTime(trade.open_time)} → {formatDateTime(trade.close_time)}
					</p>
				</div>
				<div class="text-right">
					<p class="text-3xl font-bold {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(trade.profit)}
					</p>
					<p class="text-xs text-gray-500">
						{trade.lot_size} lots • {getDuration(trade.open_time, trade.close_time)}
					</p>
				</div>
			</div>

			<div class="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
				<div>
					<p class="text-gray-500 text-xs">ราคาเปิด</p>
					<p class="text-white">{formatNumber(trade.open_price, 5)}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">ราคาปิด</p>
					<p class="text-white">{formatNumber(trade.close_price, 5)}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">Stop Loss</p>
					<p class="text-red-400">{trade.sl ? formatNumber(trade.sl, 5) : '-'}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">Take Profit</p>
					<p class="text-green-400">{trade.tp ? formatNumber(trade.tp, 5) : '-'}</p>
				</div>
			</div>

			<div class="mt-5 grid grid-cols-1 xl:grid-cols-3 gap-6">
				<div class="xl:col-span-2">
					{#if showReplay && chartContexts?.length > 0}
						{#if TradeReplayChart}
							<TradeReplayChart contexts={chartContexts} {trade} onclose={() => showReplay = false} />
						{:else}
							<div class="animate-pulse rounded-xl bg-dark-border/20 h-64 flex items-center justify-center text-gray-500 text-sm">กำลังโหลด Replay...</div>
						{/if}
					{:else}
						<MultiTimeframeChart contexts={chartContexts} {trade} />
						{#if chartContexts?.length > 0}
							<div class="mt-2 flex items-center gap-4">
								<button
									type="button"
									onclick={openReplay}
									class="text-xs text-brand-primary hover:text-brand-primary/80 flex items-center gap-1.5 transition-colors"
								>
									<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
									Quick Replay
								</button>
								<a
									href="/portfolio/trades/{trade.id}/replay"
									class="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
									</svg>
									Full Replay
								</a>
							</div>
						{/if}
					{/if}
				</div>
				<div class="space-y-4">
					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-4">
						<div class="text-xs text-gray-500">ขั้นตอน Review</div>
						<div class="mt-3 space-y-2 text-sm">
							<div class="flex items-center justify-between">
								<span class="text-gray-400">กลยุทธ์</span>
								<span class="text-white">{playbooks.find((playbook: Playbook) => playbook.id === selectedPlaybookId)?.name || 'ยังไม่เลือก'}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-gray-400">โน้ต</span>
								<span class="text-white">{noteContent ? 'พร้อม' : 'ว่าง'}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-gray-400">ไฟล์แนบ</span>
								<span class="text-white">{attachments.length}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-gray-400">กฎที่ทำผิด</span>
								<span class="text-white">{brokenRules.length}</span>
							</div>
						</div>
					</div>

					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-4">
						<div class="text-xs text-gray-500">บันทึกประจำวัน</div>
						<div class="mt-2 text-sm text-gray-300">
							{#if dayJournal}
								มี journal ของวันที่ {journalDate}
							{:else}
								ยังไม่มี journal ของวันที่ {journalDate}
							{/if}
						</div>
						<a
							href={`/portfolio/journal?date=${journalDate}&year=${new Date(trade.close_time).getFullYear()}&month=${new Date(trade.close_time).getMonth() + 1}`}
							class="mt-3 inline-flex text-xs text-brand-primary"
						>
							เปิด notebook ของวันเดียวกัน
						</a>
					</div>

					<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-4">
						<div class="text-xs text-gray-500">เกี่ยวข้อง</div>
						<div class="mt-2 text-sm text-gray-300">
							{relatedTrades.length} เทรดคู่เดียวกัน • {similarReviewedTrades.length} เทรดที่ review แล้ว
						</div>
					</div>

					{#if qualityScore > 0}
						<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-4">
							<div class="text-xs text-gray-500 mb-2">Quality Score</div>
							<QualityScoreBar score={qualityScore} />
						</div>
					{/if}
				</div>

				{#if executionMetrics.rMultiple != null || executionMetrics.executionEfficiency != null}
					<div class="mt-4">
						<ExecutionMetricsCard metrics={executionMetrics} />
					</div>
				{/if}

				{#if insights.length > 0}
					<div class="mt-6">
						<InsightsSection {insights} />
					</div>
				{/if}
			</div>
		</div>

		<div class="card">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-medium text-gray-400">แท็ก</h3>
				<div class="relative">
					<button
						type="button"
						onclick={() => showTagDropdown = !showTagDropdown}
						class="text-xs text-brand-primary hover:text-brand-primary/80"
					>
						+ เพิ่ม Tag
					</button>

					{#if showTagDropdown && availableTags.length > 0}
						<div class="absolute right-0 top-6 z-10 bg-dark-surface border border-dark-border rounded-lg shadow-lg p-2 min-w-[220px]">
							{#each availableTags as tag}
								<button
									type="button"
									onclick={() => assignTag(tag.id)}
									disabled={assigningTag}
									class="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-dark-border/50 rounded flex items-center gap-2"
								>
									<span class="w-3 h-3 rounded-full" style="background-color: {tag.color}"></span>
									{tag.name}
									<span class="text-[10px] text-gray-500 ml-auto">{tag.category}</span></button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap gap-1.5">
				{#each effectiveAssignments as assignment}
					{#if assignment.trade_tags}
						<TagPill
							name={assignment.trade_tags.name}
							color={assignment.trade_tags.color}
							category={assignment.trade_tags.category}
							removable={true}
							onremove={() => removeTag(assignment.tag_id)}
						/>
					{/if}
				{/each}
			</div>
		</div>

		<div class="card space-y-5">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-sm font-medium text-gray-400">Structured Review</h3>
					<p class="text-xs text-gray-500 mt-1">บันทึกกระบวนการ, กฎที่ผิด, บทเรียน และสิ่งที่จะทำต่อ</p>
				</div>
				{#if reviewSaved}
					<span class="text-xs text-green-400">บันทึก review แล้ว</span>
				{/if}
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
				<select bind:value={reviewStatus} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="unreviewed">ยังไม่ Review</option>
					<option value="in_progress">กำลังดำเนินการ</option>
					<option value="reviewed">Review แล้ว</option>
				</select>
				<select bind:value={selectedPlaybookId} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">ยังไม่เลือก Playbook</option>
					{#each playbooks as playbook}
						<option value={playbook.id}>{playbook.name}</option>
					{/each}
				</select>
				<select bind:value={followedPlan} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">ทำตามแผนไหม?</option>
					<option value="yes">ใช่</option>
					<option value="no">ไม่</option>
				</select>
				<input
					type="number"
					min="1"
					max="5"
					bind:value={confidenceAtEntry}
					placeholder="ความมั่นใจ 1-5"
					class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
				<input
					type="number"
					min="1"
					max="5"
					bind:value={setupQuality}
					placeholder="คุณภาพ Setup 1-5"
					class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
				<input
					type="number"
					min="1"
					max="5"
					bind:value={disciplineScore}
					placeholder="วินัย 1-5"
					class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
				<input
					type="number"
					min="1"
					max="5"
					bind:value={executionScore}
					placeholder="การ Execute 1-5"
					class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
			</div>

			<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">เหตุผลเข้าเทรด</h4>
					<textarea bind:value={entryReason} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">เหตุผลออกเทรด</h4>
					<textarea bind:value={exitReason} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">บันทึกการ Execute</h4>
					<textarea bind:value={executionNotes} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">บันทึกความเสี่ยง</h4>
					<textarea bind:value={riskNotes} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">สรุปข้อผิดพลาด</h4>
					<textarea bind:value={mistakeSummary} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">สรุปบทเรียน</h4>
					<textarea bind:value={lessonSummary} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
			</div>

			<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
				<div class="card p-4 bg-dark-bg/20">
					<ChecklistEditor
						items={brokenRules}
						label="กฎที่ทำผิด"
						placeholder="เช่น Overtraded after first loss"
						onchange={(items) => (brokenRules = items)}
					/>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">สิ่งที่จะทำต่อ</h4>
					<textarea bind:value={nextAction} rows="5" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
			</div>

			<button
				type="button"
				onclick={saveReview}
				disabled={savingReview}
				class="btn-primary text-sm py-2 px-6 disabled:opacity-50 inline-flex items-center gap-2"
			>
				{#if savingReview}
					<svg class="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
					กำลังบันทึก...
				{:else}
					บันทึก Review
				{/if}
			</button>
		</div>

		<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
			<div class="card">
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-sm font-medium text-gray-400">บันทึก Trade</h3>
					{#if noteSaved}
						<span class="text-xs text-green-400">บันทึกแล้ว!</span>
					{/if}
				</div>

				<div class="flex items-center gap-1.5 mb-3">
					<span class="text-xs text-gray-500 mr-2">คะแนน:</span>
					{#each [1, 2, 3, 4, 5] as star}
						<button
							type="button"
							onclick={() => (noteRating = noteRating === star ? null : star)}
							aria-label={`ให้คะแนน ${star} ดาว`}
							title={`ให้คะแนน ${star} ดาว`}
							class="w-5 h-5 rounded-full border-2 transition-all
							{noteRating && noteRating >= star
								? 'bg-brand-primary border-brand-primary'
								: 'bg-transparent border-gray-600 hover:border-gray-400'}"
						></button>
					{/each}
				</div>

				<textarea
					bind:value={noteContent}
					placeholder="จดบันทึกเกี่ยวกับ trade นี้"
					rows="5"
					class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-y"
				></textarea>

				<button
					type="button"
					onclick={saveNote}
					disabled={savingNote}
					class="mt-3 btn-primary text-sm py-1.5 px-4 disabled:opacity-50 inline-flex items-center gap-2"
				>
					{#if savingNote}
						<svg class="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
						กำลังบันทึก...
					{:else}
						บันทึก Note
					{/if}
				</button>
			</div>

			<div class="card space-y-4">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h3 class="text-sm font-medium text-gray-400">ไฟล์แนบ</h3>
						<p class="text-xs text-gray-500 mt-1">วาง link กราฟ, URL รูปภาพ หรืออัปโหลด Screenshot พร้อม annotation</p>
					</div>
					<button
						type="button"
						onclick={() => showAnnotator = true}
						class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 text-xs font-medium transition-colors"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
						</svg>
						Annotate Screenshot
					</button>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
					<select bind:value={attachmentKind} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
						<option value="link">ลิงก์</option>
						<option value="image_url">URL รูปภาพ</option>
					</select>
					<input bind:value={attachmentPath} placeholder="https://..." class="md:col-span-2 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
					<input bind:value={attachmentCaption} placeholder="คำอธิบาย" class="md:col-span-2 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
					<button type="button" onclick={saveAttachment} disabled={savingAttachment} class="btn-primary text-sm py-2 inline-flex items-center gap-2 disabled:opacity-50">
						{#if savingAttachment}
							<svg class="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
							กำลังบันทึก...
						{:else}
							เพิ่มไฟล์แนบ
						{/if}
					</button>
				</div>

				<div class="space-y-2">
					{#if attachments.length > 0}
						{#each attachments as attachment}
							{#if attachment.kind === 'screenshot'}
								<div class="rounded-xl bg-dark-bg/30 border border-dark-border overflow-hidden">
									<img
										src={attachment.storage_path}
										alt={attachment.caption || 'Trade screenshot'}
										class="w-full max-h-64 object-contain bg-black/30"
										loading="lazy"
									/>
									<div class="flex items-center justify-between px-3 py-2">
										<div class="min-w-0">
											<span class="text-xs font-medium text-gray-300">{attachment.caption || 'Screenshot'}</span>
											<div class="flex items-center gap-1.5 mt-0.5">
												<span class="inline-flex items-center gap-1 text-[10px] text-brand-primary/80 bg-brand-primary/10 rounded px-1.5 py-0.5">
													<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536M3 21h3.572L21 6.732a2.5 2.5 0 00-3.536-3.536L3 17.428V21z" />
													</svg>
													Annotated
												</span>
												<a
													href={attachment.storage_path}
													target="_blank"
													rel="noopener noreferrer"
													class="text-[10px] text-gray-500 hover:text-gray-300"
												>
													เปิดแบบเต็ม ↗
												</a>
											</div>
										</div>
										<button type="button" onclick={() => deleteAttachment(attachment.id)} class="text-xs text-red-300 hover:text-red-200 ml-2">
											ลบ
										</button>
									</div>
								</div>
							{:else if attachment.kind === 'image_url'}
								<div class="rounded-xl bg-dark-bg/30 border border-dark-border overflow-hidden">
									<img
										src={attachment.storage_path}
										alt={attachment.caption || 'Trade image'}
										class="w-full max-h-48 object-contain bg-black/30"
										loading="lazy"
									/>
									<div class="flex items-center justify-between px-3 py-2">
										<a href={attachment.storage_path} target="_blank" rel="noopener noreferrer" class="text-xs text-white hover:text-brand-primary truncate">
											{attachment.caption || attachment.storage_path}
										</a>
										<button type="button" onclick={() => deleteAttachment(attachment.id)} class="text-xs text-red-300 hover:text-red-200 ml-2">
											ลบ
										</button>
									</div>
								</div>
							{:else}
								<div class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3 text-sm">
									<div class="min-w-0">
										<a href={attachment.storage_path} target="_blank" rel="noopener noreferrer" class="font-medium text-white hover:text-brand-primary truncate block">
											{attachment.caption || attachment.storage_path}
										</a>
										<div class="text-[11px] text-gray-500">{attachment.kind}</div>
									</div>
									<button type="button" onclick={() => deleteAttachment(attachment.id)} class="text-xs text-red-300 hover:text-red-200">
										ลบ
									</button>
								</div>
							{/if}
						{/each}
					{:else}
						<div class="rounded-xl border border-dashed border-dark-border px-3 py-5 text-center text-sm text-gray-500">
							ยังไม่มี attachment
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
			<div class="card">
				<h3 class="text-sm font-medium text-gray-400 mb-3">Trades อื่นของ {trade.symbol}</h3>
				<div class="space-y-2">
					{#if relatedTrades.length > 0}
						{#each relatedTrades as relatedTrade}
							<a href={`/portfolio/trades/${relatedTrade.id}`} class="flex items-center justify-between p-3 rounded-xl hover:bg-dark-border/30 transition-colors">
								<div class="flex items-center gap-2">
									<span class="text-xs px-1.5 py-0.5 rounded {relatedTrade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
										{relatedTrade.type}
									</span>
									<span class="text-sm text-gray-300">{relatedTrade.lot_size} lots</span>
								</div>
								<div class="text-right">
									<div class="text-sm font-medium {relatedTrade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(relatedTrade.profit)}</div>
									<div class="text-xs text-gray-500">{formatDateTime(relatedTrade.close_time)}</div>
								</div>
							</a>
						{/each}
					{:else}
						<div class="rounded-xl border border-dashed border-dark-border px-3 py-5 text-center text-sm text-gray-500">
							ยังไม่มีเทรดอื่นของ {trade.symbol}
						</div>
					{/if}
				</div>
			</div>

			<div class="card">
				<h3 class="text-sm font-medium text-gray-400 mb-3">เทรดที่ Review แล้วคล้ายกัน</h3>
				<div class="space-y-2">
					{#if similarReviewedTrades.length > 0}
						{#each similarReviewedTrades as similarTrade}
							<a href={`/portfolio/trades/${similarTrade.id}`} class="flex items-center justify-between p-3 rounded-xl hover:bg-dark-border/30 transition-colors">
								<div>
									<div class="text-sm text-white">{similarTrade.symbol}</div>
									<div class="text-[11px] text-gray-500">{formatDateTime(similarTrade.close_time)}</div>
								</div>
								<div class="text-right">
									<div class="text-sm font-medium {similarTrade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(similarTrade.profit)}</div>
									<ReviewStatusBadge status={(similarTrade.trade_reviews?.[0]?.review_status || 'unreviewed') as import('$lib/types').ReviewStatus} />
								</div>
							</a>
						{/each}
					{:else}
						<div class="rounded-xl border border-dashed border-dark-border px-3 py-5 text-center text-sm text-gray-500">
							ยังไม่มีเทรดที่ review แล้วคล้ายกัน
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

{#if showAnnotator && trade}
	<ScreenshotAnnotator
		tradeId={trade.id}
		onclose={() => showAnnotator = false}
		onsaved={(attachment) => {
			attachments = [...attachments, attachment];
			showAnnotator = false;
		}}
	/>
{/if}
