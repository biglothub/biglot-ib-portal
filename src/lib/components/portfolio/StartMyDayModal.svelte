<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { goto } from '$app/navigation';

	let {
		open = false,
		onclose,
		checklistRules = [],
		checklistCompletions = [],
		checklistDoneToday = false,
		todayJournal = null,
		marketNews = [],
		today = ''
	}: {
		open: boolean;
		onclose: () => void;
		checklistRules?: any[];
		checklistCompletions?: any[];
		checklistDoneToday?: boolean;
		todayJournal?: any;
		marketNews?: any[];
		today?: string;
	} = $props();

	let step = $state(0); // 0 = checklist, 1 = journal, 2 = market
	let saving = $state(false);
	let localCompletions = $state<any[]>([]);

	$effect(() => {
		if (open) {
			step = 0;
			localCompletions = [...checklistCompletions];
		}
	});

	const steps = [
		{ id: 'checklist', label: 'เช็คลิสต์' },
		{ id: 'journal', label: 'บันทึกวัน' },
		{ id: 'market', label: 'ภาพตลาด' }
	];

	function isCompleted(ruleId: string) {
		return localCompletions.some((c: any) => c.rule_id === ruleId && c.completed);
	}

	const manualRules = $derived(checklistRules.filter((r: any) => r.type === 'manual'));
	const automatedRules = $derived(checklistRules.filter((r: any) => r.type === 'automated'));
	const completedCount = $derived(checklistRules.filter((r: any) => isCompleted(r.id)).length);
	const allDone = $derived(checklistRules.length > 0 && completedCount === checklistRules.length);

	async function toggleRule(ruleId: string) {
		const nowCompleted = !isCompleted(ruleId);
		// Optimistic update
		const existing = localCompletions.findIndex((c: any) => c.rule_id === ruleId);
		if (existing >= 0) {
			localCompletions[existing] = { ...localCompletions[existing], completed: nowCompleted };
		} else {
			localCompletions = [...localCompletions, { rule_id: ruleId, completed: nowCompleted, date: today }];
		}

		saving = true;
		try {
			await fetch('/api/portfolio/checklist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'toggle', rule_id: ruleId, date: today, completed: nowCompleted })
			});
		} finally {
			saving = false;
		}
	}

	function next() {
		if (step < steps.length - 1) step++;
		else done();
	}

	function prev() {
		if (step > 0) step--;
	}

	function done() {
		onclose();
	}

	function goJournal() {
		goto('/portfolio/journal');
		onclose();
	}

	const topNews = $derived(marketNews.slice(0, 4));

	function impactColor(impact: string) {
		if (impact === 'high') return 'text-red-400 bg-red-400/10';
		if (impact === 'medium') return 'text-amber-400 bg-amber-400/10';
		return 'text-gray-400 bg-gray-400/10';
	}
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
		onclick={onclose}
		onkeydown={(e) => e.key === 'Escape' && onclose()}
		role="button"
		tabindex="-1"
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Modal -->
	<div
		class="fixed inset-0 z-[101] flex items-end sm:items-center justify-center p-0 sm:p-4"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="w-full sm:max-w-md max-h-[90vh] bg-dark-surface border border-dark-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
			transition:fly={{ y: 40, duration: 280 }}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-dark-border shrink-0">
				<div>
					<h2 class="text-base font-bold text-white">เริ่มต้นวันนี้</h2>
					<p class="text-[11px] text-gray-500 mt-0.5">{today}</p>
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
						onclick={() => step = i}
						class="flex-1 text-xs font-medium pb-2.5 border-b-2 transition-colors
							{step === i
							? 'text-brand-primary border-brand-primary'
							: 'text-gray-500 border-transparent hover:text-gray-300'}"
					>
						<span class="flex items-center justify-center gap-1.5">
							<span class="w-4 h-4 rounded-full text-[10px] flex items-center justify-center
								{step === i ? 'bg-brand-primary text-dark-bg font-bold' : 'bg-dark-border text-gray-400'}">
								{i + 1}
							</span>
							{s.label}
						</span>
					</button>
				{/each}
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-5 min-h-0">
				{#if step === 0}
					<!-- Checklist Step -->
					<div class="space-y-3">
						{#if checklistRules.length === 0}
							<div class="text-center py-8">
								<div class="w-12 h-12 rounded-full bg-dark-border/50 flex items-center justify-center mx-auto mb-3">
									<svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
									</svg>
								</div>
								<p class="text-sm text-gray-400">ยังไม่มีเช็คลิสต์</p>
								<p class="text-xs text-gray-600 mt-1">ตั้งค่า checklist ได้ที่หน้า Progress</p>
								<a
									href="/portfolio/progress"
									onclick={onclose}
									class="inline-block mt-3 px-4 py-2 rounded-lg bg-brand-primary/10 text-brand-primary text-xs font-medium hover:bg-brand-primary/20 transition-colors"
								>
									ไปตั้งค่า
								</a>
							</div>
						{:else}
							<!-- Progress bar -->
							<div class="flex items-center gap-3 mb-1">
								<div class="flex-1 h-1.5 rounded-full bg-dark-border overflow-hidden">
									<div
										class="h-full rounded-full transition-all duration-300
											{allDone ? 'bg-green-500' : 'bg-brand-primary'}"
										style="width: {checklistRules.length > 0 ? (completedCount / checklistRules.length) * 100 : 0}%"
									></div>
								</div>
								<span class="text-xs text-gray-500 shrink-0">{completedCount}/{checklistRules.length}</span>
							</div>

							{#if allDone}
								<div class="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 px-3 py-2.5 text-sm text-green-400">
									<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
									</svg>
									เช็คลิสต์วันนี้ครบแล้ว พร้อมเทรด!
								</div>
							{/if}

							<!-- Manual Rules -->
							{#if manualRules.length > 0}
								<div class="text-[10px] uppercase tracking-wider text-gray-600 mb-1">ตรวจด้วยตนเอง</div>
								{#each manualRules as rule}
									<button
										onclick={() => toggleRule(rule.id)}
										disabled={saving}
										class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors
											{isCompleted(rule.id) ? 'bg-green-500/10 border border-green-500/20' : 'bg-dark-bg/40 hover:bg-dark-bg/60 border border-transparent'}"
									>
										<div class="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
											{isCompleted(rule.id) ? 'border-green-500 bg-green-500' : 'border-gray-600'}">
											{#if isCompleted(rule.id)}
												<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
												</svg>
											{/if}
										</div>
										<span class="text-sm {isCompleted(rule.id) ? 'text-gray-400 line-through' : 'text-gray-200'}">
											{rule.name}
										</span>
									</button>
								{/each}
							{/if}

							<!-- Automated Rules -->
							{#if automatedRules.length > 0}
								<div class="text-[10px] uppercase tracking-wider text-gray-600 mt-2 mb-1">อัตโนมัติ</div>
								{#each automatedRules as rule}
									<div class="flex items-center justify-between rounded-xl px-3 py-2.5 border
										{isCompleted(rule.id) ? 'bg-green-500/10 border-green-500/20' : 'bg-dark-bg/40 border-transparent'}">
										<div class="flex items-center gap-3">
											<div class="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
												{isCompleted(rule.id) ? 'border-green-500 bg-green-500' : 'border-gray-600'}">
												{#if isCompleted(rule.id)}
													<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
													</svg>
												{/if}
											</div>
											<span class="text-sm {isCompleted(rule.id) ? 'text-gray-400' : 'text-gray-200'}">{rule.name}</span>
										</div>
										<span class="text-xs {isCompleted(rule.id) ? 'text-green-400' : 'text-gray-500'}">
											{isCompleted(rule.id) ? 'ผ่าน' : 'รอตรวจ'}
										</span>
									</div>
								{/each}
							{/if}
						{/if}
					</div>

				{:else if step === 1}
					<!-- Journal Step -->
					<div class="space-y-4">
						{#if todayJournal && todayJournal.completion_status === 'complete'}
							<div class="flex items-center gap-3 rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3">
								<svg class="w-5 h-5 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
								</svg>
								<div>
									<p class="text-sm font-medium text-green-400">บันทึกวันนี้เสร็จแล้ว</p>
									<p class="text-xs text-gray-500 mt-0.5">คุณบันทึก journal ของวันนี้เรียบร้อยแล้ว</p>
								</div>
							</div>
							<button
								onclick={goJournal}
								class="w-full rounded-xl border border-dark-border px-4 py-3 text-sm text-gray-300 hover:text-white hover:border-brand-primary/40 transition-colors text-left"
							>
								เปิดดู journal วันนี้ →
							</button>
						{:else}
							<div class="rounded-xl bg-dark-bg/40 border border-dark-border p-4 space-y-3">
								<div class="flex items-center gap-2">
									<div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
										<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
										</svg>
									</div>
									<p class="text-sm font-medium text-white">ยังไม่มี journal วันนี้</p>
								</div>
								<p class="text-xs text-gray-500 leading-relaxed">
									การบันทึก journal ช่วยให้คุณเข้าใจรูปแบบการเทรดของตัวเอง และพัฒนาได้ต่อเนื่อง ใช้เวลาเพียง 2-3 นาที
								</p>
								<div class="text-xs text-gray-600 space-y-1">
									<p>แนะนำให้บันทึก:</p>
									<ul class="ml-3 space-y-0.5 text-gray-500 list-disc list-inside">
										<li>อารมณ์ก่อนเทรดวันนี้</li>
										<li>แผนการเทรดและ setup ที่วางไว้</li>
										<li>สิ่งที่ต้องระวังวันนี้</li>
									</ul>
								</div>
							</div>
							<button
								onclick={goJournal}
								class="w-full rounded-xl bg-brand-primary text-dark-bg px-4 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
							>
								เขียน journal วันนี้
							</button>
							<button
								onclick={next}
								class="w-full rounded-xl border border-dark-border px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
							>
								ข้ามไปก่อน
							</button>
						{/if}
					</div>

				{:else if step === 2}
					<!-- Market Summary Step -->
					<div class="space-y-3">
						<p class="text-[10px] uppercase tracking-wider text-gray-600">ข่าวตลาดล่าสุด</p>
						{#if topNews.length === 0}
							<div class="text-center py-8">
								<p class="text-sm text-gray-500">ยังไม่มีข่าวตลาดวันนี้</p>
								<p class="text-xs text-gray-600 mt-1">ข่าวจะอัพเดทเมื่อระบบดึงข้อมูล</p>
							</div>
						{:else}
							{#each topNews as article}
								<div class="rounded-xl bg-dark-bg/40 border border-dark-border px-3 py-3 space-y-1.5">
									<div class="flex items-start gap-2">
										{#if article.impact}
											<span class="text-[10px] font-medium px-1.5 py-0.5 rounded {impactColor(article.impact)} shrink-0 mt-0.5">
												{article.impact === 'high' ? 'สูง' : article.impact === 'medium' ? 'กลาง' : 'ต่ำ'}
											</span>
										{/if}
										<p class="text-sm text-gray-200 leading-snug">{article.title || article.headline}</p>
									</div>
									{#if article.summary}
										<p class="text-xs text-gray-500 leading-relaxed line-clamp-2">{article.summary}</p>
									{/if}
								</div>
							{/each}
						{/if}

						<div class="rounded-xl bg-brand-primary/5 border border-brand-primary/20 px-4 py-3 mt-4">
							<p class="text-xs text-brand-primary font-medium">พร้อมเทรดแล้ว</p>
							<p class="text-[11px] text-gray-500 mt-1">คุณผ่านการเตรียมพร้อมแล้ว ขอให้เทรดด้วยวินัย</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-5 py-4 border-t border-dark-border flex items-center gap-3 shrink-0">
				{#if step > 0}
					<button
						onclick={prev}
						class="px-4 py-2.5 rounded-xl border border-dark-border text-sm text-gray-400 hover:text-white transition-colors"
					>
						ย้อนกลับ
					</button>
				{/if}
				<button
					onclick={next}
					class="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
						{step === steps.length - 1
						? 'bg-green-500 hover:bg-green-400 text-white'
						: 'bg-brand-primary hover:opacity-90 text-dark-bg'}"
				>
					{step === steps.length - 1 ? 'เริ่มเทรดเลย' : 'ถัดไป'}
				</button>
			</div>
		</div>
	</div>
{/if}
