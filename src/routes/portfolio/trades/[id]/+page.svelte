<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import ChecklistEditor from '$lib/components/portfolio/ChecklistEditor.svelte';
	import TradeContextChart from '$lib/components/portfolio/TradeContextChart.svelte';
	import { formatCurrency, formatNumber, formatDateTime, toThaiDateString } from '$lib/utils';

	let { data } = $props();
	let { trade, relatedTrades, chartContexts, dayJournal, playbooks } = $derived(data);
	let similarReviewedTrades = $derived(data.similarReviewedTrades || []);
	let tags = $derived(data.tags || []);

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
	let attachmentKind = $state<'link' | 'image_url'>('link');
	let attachmentPath = $state('');
	let attachmentCaption = $state('');
	let savingAttachment = $state(false);
	let actionError = $state('');

	const assignedTagIds = $derived(
		new Set((trade?.trade_tag_assignments || []).map((assignment: any) => assignment.tag_id))
	);
	const availableTags = $derived(tags.filter((tag: any) => !assignedTagIds.has(tag.id)));
	const review = $derived(trade?.trade_reviews?.[0] || null);
	const journalDate = $derived(
		trade ? toThaiDateString(trade.close_time) : ''
	);

	$effect(() => {
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
		noteSaved = false;
		actionError = '';

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/notes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: noteContent, rating: noteRating })
			});

			if (res.ok) {
				noteSaved = true;
				setTimeout(() => (noteSaved = false), 2000);
			} else {
				actionError = 'ไม่สามารถบันทึก Note ได้';
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			savingNote = false;
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
				invalidateAll();
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
		assigningTag = true;
		actionError = '';

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/tags`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tag_id: tagId })
			});
			if (!res.ok) {
				actionError = 'ไม่สามารถเพิ่ม Tag ได้';
				return;
			}
			showTagDropdown = false;
			invalidateAll();
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			assigningTag = false;
		}
	}

	async function removeTag(tagId: string) {
		if (!trade) return;
		actionError = '';

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/tags`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tag_id: tagId })
			});
			if (!res.ok) {
				actionError = 'ไม่สามารถลบ Tag ได้';
				return;
			}
			invalidateAll();
		} catch {
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
				invalidateAll();
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
			invalidateAll();
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
					<p class="text-gray-500 text-xs">Open Price</p>
					<p class="text-white">{formatNumber(trade.open_price, 5)}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">Close Price</p>
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
					<TradeContextChart contexts={chartContexts} {trade} />
				</div>
				<div class="space-y-4">
					<div class="rounded-2xl border border-dark-border bg-dark-bg/30 p-4">
						<div class="text-xs text-gray-500">Review Workflow</div>
						<div class="mt-3 space-y-2 text-sm">
							<div class="flex items-center justify-between">
								<span class="text-gray-400">Playbook</span>
								<span class="text-white">{playbooks.find((playbook: any) => playbook.id === selectedPlaybookId)?.name || 'ยังไม่เลือก'}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-gray-400">Notes</span>
								<span class="text-white">{noteContent ? 'พร้อม' : 'ว่าง'}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-gray-400">Attachments</span>
								<span class="text-white">{attachments.length}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-gray-400">Broken rules</span>
								<span class="text-white">{brokenRules.length}</span>
							</div>
						</div>
					</div>

					<div class="rounded-2xl border border-dark-border bg-dark-bg/30 p-4">
						<div class="text-xs text-gray-500">Notebook</div>
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

					<div class="rounded-2xl border border-dark-border bg-dark-bg/30 p-4">
						<div class="text-xs text-gray-500">Related</div>
						<div class="mt-2 text-sm text-gray-300">
							{relatedTrades.length} same-symbol trades • {similarReviewedTrades.length} similar reviewed trades
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="card">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-medium text-gray-400">Tags</h3>
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
				{#each (trade.trade_tag_assignments || []) as assignment}
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
					<p class="text-xs text-gray-500 mt-1">Capture process, rule breaks, lessons, and next action.</p>
				</div>
				{#if reviewSaved}
					<span class="text-xs text-green-400">บันทึก review แล้ว</span>
				{/if}
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
				<select bind:value={reviewStatus} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="unreviewed">Unreviewed</option>
					<option value="in_progress">In Progress</option>
					<option value="reviewed">Reviewed</option>
				</select>
				<select bind:value={selectedPlaybookId} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">No playbook</option>
					{#each playbooks as playbook}
						<option value={playbook.id}>{playbook.name}</option>
					{/each}
				</select>
				<select bind:value={followedPlan} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">Followed plan?</option>
					<option value="yes">Yes</option>
					<option value="no">No</option>
				</select>
				<input
					type="number"
					min="1"
					max="5"
					bind:value={confidenceAtEntry}
					placeholder="Confidence 1-5"
					class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
				<input
					type="number"
					min="1"
					max="5"
					bind:value={setupQuality}
					placeholder="Setup quality"
					class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
				<input
					type="number"
					min="1"
					max="5"
					bind:value={disciplineScore}
					placeholder="Discipline"
					class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
				<input
					type="number"
					min="1"
					max="5"
					bind:value={executionScore}
					placeholder="Execution"
					class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
			</div>

			<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">Entry Reason</h4>
					<textarea bind:value={entryReason} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">Exit Reason</h4>
					<textarea bind:value={exitReason} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">Execution Notes</h4>
					<textarea bind:value={executionNotes} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">Risk Notes</h4>
					<textarea bind:value={riskNotes} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">Mistake Summary</h4>
					<textarea bind:value={mistakeSummary} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">Lesson Summary</h4>
					<textarea bind:value={lessonSummary} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
			</div>

			<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
				<div class="card p-4 bg-dark-bg/20">
					<ChecklistEditor
						items={brokenRules}
						label="Broken Rules"
						placeholder="เช่น Overtraded after first loss"
						onchange={(items) => (brokenRules = items)}
					/>
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<h4 class="text-xs text-gray-500 mb-2">Next Action</h4>
					<textarea bind:value={nextAction} rows="5" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
				</div>
			</div>

			<button
				type="button"
				onclick={saveReview}
				disabled={savingReview}
				class="btn-primary text-sm py-2 px-6 disabled:opacity-50"
			>
				{savingReview ? 'กำลังบันทึก...' : 'บันทึก Structured Review'}
			</button>
		</div>

		<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
			<div class="card">
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-sm font-medium text-gray-400">Trade Notes</h3>
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
					class="mt-3 btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
				>
					{savingNote ? 'กำลังบันทึก...' : 'บันทึก Note'}
				</button>
			</div>

			<div class="card space-y-4">
				<div>
					<h3 class="text-sm font-medium text-gray-400">Attachments</h3>
					<p class="text-xs text-gray-500 mt-1">Paste chart links or hosted image URLs for review context.</p>
				</div>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
					<select bind:value={attachmentKind} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
						<option value="link">Link</option>
						<option value="image_url">Image URL</option>
					</select>
					<input bind:value={attachmentPath} placeholder="https://..." class="md:col-span-2 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
					<input bind:value={attachmentCaption} placeholder="Caption" class="md:col-span-2 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
					<button type="button" onclick={saveAttachment} disabled={savingAttachment} class="btn-primary text-sm py-2">
						{savingAttachment ? 'Saving...' : 'Add Attachment'}
					</button>
				</div>

				<div class="space-y-2">
					{#if attachments.length > 0}
						{#each attachments as attachment}
							<div class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3 text-sm">
								<div class="min-w-0">
									<a href={attachment.storage_path} target="_blank" class="font-medium text-white hover:text-brand-primary truncate block">
										{attachment.caption || attachment.storage_path}
									</a>
									<div class="text-[11px] text-gray-500">{attachment.kind}</div>
								</div>
								<button type="button" onclick={() => deleteAttachment(attachment.id)} class="text-xs text-red-300 hover:text-red-200">
									ลบ
								</button>
							</div>
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
				</div>
			</div>

			<div class="card">
				<h3 class="text-sm font-medium text-gray-400 mb-3">Similar Reviewed Trades</h3>
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
									<ReviewStatusBadge status={similarTrade.trade_reviews?.[0]?.review_status || 'unreviewed'} />
								</div>
							</a>
						{/each}
					{:else}
						<div class="rounded-xl border border-dashed border-dark-border px-3 py-5 text-center text-sm text-gray-500">
							ยังไม่มี similar reviewed trades
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
