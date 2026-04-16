<script lang="ts">
	import { focusTrap } from '$lib/actions/focusTrap';
	import { fly, fade } from 'svelte/transition';
	import { getTradeReviewStatus, getTradePlaybookId } from '$lib/portfolio';
	import type { Trade, Playbook, DailyJournal } from '$lib/types';

	let {
		open = $bindable(false),
		onclose,
		date = '',
		dayTrades = [],
		playbooks = [],
		existingJournal = null,
		accountId = ''
	}: {
		open: boolean;
		onclose: () => void;
		date?: string;
		dayTrades?: Trade[];
		playbooks?: Playbook[];
		existingJournal?: DailyJournal | null;
		accountId?: string;
	} = $props();

	const steps = [
		{ id: 'trades', label: 'รีวิวเทรด' },
		{ id: 'journal', label: 'บันทึกหลังเทรด' },
		{ id: 'scores', label: 'คะแนนวันนี้' },
		{ id: 'finalize', label: 'ปิดวัน' }
	];

	let step = $state(0);
	let saving = $state(false);
	let errorMessage = $state('');

	// Step 1: quick reviews per trade
	// Map: tradeId → { playbookId, lesson }
	let quickReviews = $state<Record<string, { playbookId: string; lesson: string }>>({});

	// Step 2: journal fields
	let postMarketNotes = $state('');
	let lessons = $state('');
	let tomorrowFocus = $state('');
	let generatingRecap = $state(false);

	// Step 3: score fields (1-5)
	let mood = $state<number | null>(null);
	let energyScore = $state<number | null>(null);
	let disciplineScore = $state<number | null>(null);
	let confidenceScore = $state<number | null>(null);

	const moodLabels = ['แย่มาก', 'แย่', 'ปานกลาง', 'ดี', 'ดีมาก'];

	// Initialize from existing journal when opened
	$effect(() => {
		if (open) {
			step = 0;
			errorMessage = '';
			quickReviews = {};
			postMarketNotes = existingJournal?.post_market_notes || '';
			lessons = existingJournal?.lessons || '';
			tomorrowFocus = existingJournal?.tomorrow_focus || '';
			mood = existingJournal?.mood ?? null;
			energyScore = existingJournal?.energy_score ?? null;
			disciplineScore = existingJournal?.discipline_score ?? null;
			confidenceScore = existingJournal?.confidence_score ?? null;

			// Pre-fill quickReviews with current playbook assignments for unreviewed trades
			for (const t of unreviewedTrades) {
				quickReviews[t.id] = {
					playbookId: getTradePlaybookId(t) || '',
					lesson: ''
				};
			}

			// Auto-fill post-market if blank
			if (!postMarketNotes && dayTrades.length > 0) {
				autoFillPostMarket();
			}
		}
	});

	const unreviewedTrades = $derived(
		dayTrades.filter((t) => getTradeReviewStatus(t) === 'unreviewed')
	);

	const reviewedCount = $derived(
		Object.values(quickReviews).filter((r) => r.playbookId || r.lesson.trim()).length
	);

	function autoFillPostMarket() {
		const wins = dayTrades.filter((t) => (t.profit ?? 0) > 0);
		const losses = dayTrades.filter((t) => (t.profit ?? 0) < 0);
		const totalPnl = dayTrades.reduce((s, t) => s + (t.profit ?? 0), 0);
		const symbols = [...new Set(dayTrades.map((t) => t.symbol))];
		postMarketNotes = `สรุปผลวันนี้: ${dayTrades.length} เทรด | ชนะ ${wins.length} | แพ้ ${losses.length} | P&L: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}\nSymbols: ${symbols.join(', ') || '-'}\n\nจุดที่ทำได้ดี:\n- \n\nจุดที่ต้องปรับปรุง:\n- `;
	}

	async function generateSessionRecap() {
		if (!date || generatingRecap) return;
		generatingRecap = true;
		try {
			const res = await fetch('/api/portfolio/journal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'generate_session_recap', date })
			});
			const result = await res.json();
			if (res.ok && result.html) {
				postMarketNotes = result.html;
			}
		} finally {
			generatingRecap = false;
		}
	}

	function applyPlaybookToAll(playbookId: string) {
		if (!playbookId) return;
		const next = { ...quickReviews };
		for (const t of unreviewedTrades) {
			next[t.id] = { ...next[t.id], playbookId };
		}
		quickReviews = next;
	}

	let bulkApplyPlaybookId = $state('');

	function next() {
		if (step < steps.length - 1) step++;
	}

	function prev() {
		if (step > 0) step--;
	}

	async function finalize() {
		if (saving) return;
		saving = true;
		errorMessage = '';

		try {
			// 1. Save quick reviews (trades with any content)
			const reviewPromises = Object.entries(quickReviews)
				.filter(([, r]) => r.playbookId || r.lesson.trim())
				.map(([tradeId, r]) =>
					fetch(`/api/portfolio/trades/${tradeId}/review`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							playbook_id: r.playbookId || null,
							review_status: 'in_progress',
							lesson_summary: r.lesson || ''
						})
					})
				);

			// 2. Save journal with completion = complete
			const journalPromise = fetch('/api/portfolio/journal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_account_id: accountId,
					date,
					pre_market_notes: existingJournal?.pre_market_notes || '',
					post_market_notes: postMarketNotes,
					session_plan: existingJournal?.session_plan || '',
					market_bias: existingJournal?.market_bias || '',
					key_levels: existingJournal?.key_levels || '',
					mood,
					energy_score: energyScore,
					discipline_score: disciplineScore,
					confidence_score: confidenceScore,
					lessons,
					tomorrow_focus: tomorrowFocus,
					completion_status: 'complete'
				})
			});

			const results = await Promise.all([...reviewPromises, journalPromise]);
			const failed = results.find((r) => !r.ok);
			if (failed) {
				errorMessage = 'บันทึกบางส่วนไม่สำเร็จ กรุณาลองใหม่';
				return;
			}

			onclose();
		} catch {
			errorMessage = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
		} finally {
			saving = false;
		}
	}

	function handleDialogKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		}
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] cursor-default"
		onclick={onclose}
		tabindex="-1"
		aria-hidden="true"
		aria-label="ปิด"
		transition:fade={{ duration: 200 }}
	></button>

	<!-- Modal -->
	<div
		use:focusTrap={{ enabled: open }}
		class="fixed inset-0 z-[101] flex items-end sm:items-center justify-center p-0 sm:p-4"
		transition:fade={{ duration: 150 }}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="end-of-day-title"
			tabindex="-1"
			class="w-full sm:max-w-lg max-h-[90vh] bg-dark-surface border border-dark-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden focus:outline-none"
			transition:fly={{ y: 40, duration: 280 }}
			onkeydown={handleDialogKeydown}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-dark-border shrink-0">
				<div>
					<h2 id="end-of-day-title" class="text-base font-bold text-white">🌙 ปิดวัน</h2>
					<p class="text-[11px] text-gray-400 mt-0.5">{date}</p>
				</div>
				<button
					onclick={onclose}
					class="p-2 rounded-lg hover:bg-dark-border/50 text-gray-400 hover:text-white transition-colors"
					aria-label="ปิด"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>

			<!-- Step Tabs -->
			<div class="flex gap-0 px-4 pt-3 pb-0 shrink-0">
				{#each steps as s, i}
					<button
						onclick={() => (step = i)}
						class="flex-1 text-xs font-medium pb-2.5 border-b-2 transition-colors
							{step === i
							? 'text-brand-primary border-brand-primary'
							: 'text-gray-400 border-transparent hover:text-gray-300'}"
					>
						<span class="flex items-center justify-center gap-1.5">
							<span
								class="w-4 h-4 rounded-full text-[10px] flex items-center justify-center
								{step === i ? 'bg-brand-primary text-dark-bg font-bold' : 'bg-dark-border text-gray-400'}"
							>
								{i + 1}
							</span>
							<span class="hidden sm:inline">{s.label}</span>
						</span>
					</button>
				{/each}
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-5 min-h-0">
				{#if step === 0}
					<!-- Step 1: Unreviewed Trades -->
					<div class="space-y-3">
						{#if unreviewedTrades.length === 0}
							<div class="text-center py-8">
								<svg class="w-12 h-12 mx-auto text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
								</svg>
								<p class="text-sm text-white">เทรดทั้งหมดถูก review แล้ว</p>
								<p class="text-xs text-gray-400 mt-1">ไปขั้นตอนต่อไปได้เลย</p>
							</div>
						{:else}
							<div class="flex items-center justify-between gap-3 mb-2">
								<p class="text-xs text-gray-400">{unreviewedTrades.length} เทรดรอ review</p>
								{#if playbooks.length > 0}
									<div class="flex items-center gap-2">
										<select
											bind:value={bulkApplyPlaybookId}
											class="bg-dark-bg border border-dark-border rounded px-2 py-1 text-[11px] text-white"
										>
											<option value="">-- ใส่ playbook ทุกเทรด --</option>
											{#each playbooks as pb}
												<option value={pb.id}>{pb.name}</option>
											{/each}
										</select>
										<button
											type="button"
											onclick={() => applyPlaybookToAll(bulkApplyPlaybookId)}
											disabled={!bulkApplyPlaybookId}
											class="text-[11px] px-2 py-1 rounded bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 disabled:opacity-40"
										>
											ใส่ทั้งหมด
										</button>
									</div>
								{/if}
							</div>

							{#each unreviewedTrades as trade (trade.id)}
								<div class="rounded-xl bg-dark-bg/40 border border-dark-border px-3 py-3 space-y-2">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span class="text-sm font-medium text-white">{trade.symbol}</span>
											<span class="text-[10px] px-1.5 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
												{trade.type}
											</span>
										</div>
										<span class="text-sm font-medium {(trade.profit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}">
											{(trade.profit ?? 0) >= 0 ? '+' : ''}{(trade.profit ?? 0).toFixed(2)}
										</span>
									</div>
									<div class="grid grid-cols-1 gap-2">
										<select
											bind:value={quickReviews[trade.id].playbookId}
											class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs text-white"
										>
											<option value="">-- เลือก Playbook --</option>
											{#each playbooks as pb}
												<option value={pb.id}>{pb.name}</option>
											{/each}
										</select>
										<input
											bind:value={quickReviews[trade.id].lesson}
											placeholder="บทเรียนสั้นๆ (ถ้ามี)"
											class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-xs text-white placeholder:text-gray-500"
										/>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{:else if step === 1}
					<!-- Step 2: Journal Post-Market -->
					<div class="space-y-4">
						<div>
							<div class="flex items-center justify-between mb-2">
								<h4 class="text-xs text-gray-400">บันทึกหลังเทรด</h4>
								<button
									type="button"
									onclick={generateSessionRecap}
									disabled={generatingRecap || !date}
									class="text-[11px] text-brand-primary hover:underline disabled:opacity-50"
								>
									{generatingRecap ? 'กำลังสร้าง...' : 'สร้างสรุป Session'}
								</button>
							</div>
							<textarea
								bind:value={postMarketNotes}
								rows="6"
								placeholder="สรุปผลการเทรดวันนี้..."
								class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"
							></textarea>
						</div>

						<div>
							<h4 class="text-xs text-gray-400 mb-2">บทเรียน</h4>
							<textarea
								bind:value={lessons}
								rows="3"
								placeholder="บทเรียนที่ได้รับ..."
								class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"
							></textarea>
						</div>

						<div>
							<h4 class="text-xs text-gray-400 mb-2">จุดโฟกัสพรุ่งนี้</h4>
							<textarea
								bind:value={tomorrowFocus}
								rows="3"
								placeholder="สิ่งที่จะโฟกัสพรุ่งนี้..."
								class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"
							></textarea>
						</div>
					</div>
				{:else if step === 2}
					<!-- Step 3: Scores -->
					<div class="space-y-4">
						<div>
							<h4 class="text-xs text-gray-400 mb-2">อารมณ์</h4>
							<div class="flex flex-wrap gap-1.5">
								{#each moodLabels as label, index}
									<button
										type="button"
										onclick={() => (mood = mood === index + 1 ? null : index + 1)}
										class="px-3 py-1.5 text-xs rounded-lg border transition-all
											{mood === index + 1
											? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
											: 'border-dark-border text-gray-400 hover:text-gray-300'}"
									>
										{label}
									</button>
								{/each}
							</div>
						</div>

						<div class="grid grid-cols-3 gap-3">
							<div>
								<h4 class="text-xs text-gray-400 mb-2">พลังงาน (1-5)</h4>
								<input
									type="number"
									min="1"
									max="5"
									bind:value={energyScore}
									class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"
								/>
							</div>
							<div>
								<h4 class="text-xs text-gray-400 mb-2">วินัย (1-5)</h4>
								<input
									type="number"
									min="1"
									max="5"
									bind:value={disciplineScore}
									class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"
								/>
							</div>
							<div>
								<h4 class="text-xs text-gray-400 mb-2">ความมั่นใจ (1-5)</h4>
								<input
									type="number"
									min="1"
									max="5"
									bind:value={confidenceScore}
									class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"
								/>
							</div>
						</div>
					</div>
				{:else if step === 3}
					<!-- Step 4: Finalize -->
					<div class="space-y-4">
						<div class="rounded-xl bg-brand-primary/5 border border-brand-primary/20 p-4 space-y-2">
							<p class="text-sm font-medium text-brand-primary">สรุปก่อนปิดวัน</p>
							<div class="text-xs text-gray-400 space-y-1">
								<div class="flex items-center justify-between">
									<span>รีวิวเทรด</span>
									<span class="text-white">{reviewedCount}/{unreviewedTrades.length} เทรด</span>
								</div>
								<div class="flex items-center justify-between">
									<span>บันทึกหลังเทรด</span>
									<span class="text-white">{postMarketNotes.trim() ? '✓ กรอกแล้ว' : '– ว่าง'}</span>
								</div>
								<div class="flex items-center justify-between">
									<span>บทเรียน</span>
									<span class="text-white">{lessons.trim() ? '✓ กรอกแล้ว' : '– ว่าง'}</span>
								</div>
								<div class="flex items-center justify-between">
									<span>คะแนน (mood/energy/discipline/confidence)</span>
									<span class="text-white">
										{[mood, energyScore, disciplineScore, confidenceScore].filter((v) => v != null).length}/4
									</span>
								</div>
							</div>
						</div>

						<div class="rounded-xl bg-green-500/5 border border-green-500/20 p-4">
							<p class="text-xs text-green-400">
								กดปุ่ม "🌙 ปิดวัน" จะบันทึก journal เป็น <strong>เสร็จสิ้น</strong> และรีวิวเทรดที่กรอกไว้ทั้งหมด
							</p>
						</div>

						{#if errorMessage}
							<div class="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
								{errorMessage}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-5 py-4 border-t border-dark-border flex items-center gap-3 shrink-0">
				{#if step > 0}
					<button
						onclick={prev}
						disabled={saving}
						class="px-4 py-2.5 rounded-xl border border-dark-border text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
					>
						ย้อนกลับ
					</button>
				{/if}
				{#if step < steps.length - 1}
					<button
						onclick={next}
						class="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-primary hover:opacity-90 text-dark-bg transition-all"
					>
						ถัดไป
					</button>
				{:else}
					<button
						onclick={finalize}
						disabled={saving}
						class="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-400 text-white transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
					>
						{#if saving}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
							กำลังปิดวัน...
						{:else}
							🌙 ปิดวัน
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
