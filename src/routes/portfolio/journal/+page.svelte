<script lang="ts">
	import { goto } from '$app/navigation';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import ChecklistEditor from '$lib/components/portfolio/ChecklistEditor.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import JournalTemplates from '$lib/components/portfolio/JournalTemplates.svelte';
	import TiptapEditor from '$lib/components/portfolio/TiptapEditor.svelte';
	import { formatCurrency, formatDateTime } from '$lib/utils';
	import { getTradeReviewStatus } from '$lib/portfolio';
	import type { DailyJournal } from '$lib/types';

	type DailyHistoryItem = { date: string; profit: number; totalTrades: number; reviewedTrades?: number };

	let { data } = $props();
	let journals = $derived(data.journals || []);
	let dailyHistory = $derived(data.dailyHistory || []);
	let selectedDate = $derived(data.selectedDate || '');
	let selectedJournal = $derived(data.selectedJournal);
	let year: number = $derived(data.year || new Date().getFullYear());
	let month: number = $derived(data.month || new Date().getMonth() + 1);
	let filterState = $derived(data.filterState);
	let filterOptions = $derived(data.filterOptions);
	let tags = $derived(data.tags || []);
	let playbooks = $derived(data.playbooks || []);
	let journalSummary = $derived(data.journalSummary);
	let dayTrades = $derived(data.dayTrades || []);

	let preMarketNotes = $state('');
	let postMarketNotes = $state('');
	let sessionPlan = $state('');
	let marketBias = $state('');
	let keyLevels = $state('');
	let checklist = $state<string[]>([]);
	let mood = $state<number | null>(null);
	let energyScore = $state<number | null>(null);
	let disciplineScore = $state<number | null>(null);
	let confidenceScore = $state<number | null>(null);
	let lessons = $state('');
	let tomorrowFocus = $state('');
	let completionStatus = $state<'not_started' | 'in_progress' | 'complete'>('not_started');
	let saving = $state(false);
	let saved = $state(false);
	let actionError = $state('');
	let showTemplates = $state(false);

	/** Wrap plain text in <p> tags for Tiptap compatibility */
	function toHtml(text: string): string {
		if (!text) return '';
		if (text.includes('<')) return text; // Already contains HTML
		return text.split('\n').filter(Boolean).map((line) => `<p>${line}</p>`).join('');
	}

	function applyTemplate(fields: Partial<{
		preMarketNotes: string;
		postMarketNotes: string;
		sessionPlan: string;
		marketBias: string;
		keyLevels: string;
		lessons: string;
		tomorrowFocus: string;
	}>) {
		if (fields.preMarketNotes !== undefined) preMarketNotes = toHtml(fields.preMarketNotes);
		if (fields.postMarketNotes !== undefined) postMarketNotes = toHtml(fields.postMarketNotes);
		if (fields.sessionPlan !== undefined) sessionPlan = toHtml(fields.sessionPlan);
		if (fields.marketBias !== undefined) marketBias = fields.marketBias;
		if (fields.keyLevels !== undefined) keyLevels = fields.keyLevels;
		if (fields.lessons !== undefined) lessons = toHtml(fields.lessons);
		if (fields.tomorrowFocus !== undefined) tomorrowFocus = toHtml(fields.tomorrowFocus);
	}

	$effect(() => {
		preMarketNotes = toHtml(selectedJournal?.pre_market_notes || '');
		postMarketNotes = toHtml(selectedJournal?.post_market_notes || '');
		sessionPlan = toHtml(selectedJournal?.session_plan || '');
		marketBias = selectedJournal?.market_bias || '';
		keyLevels = selectedJournal?.key_levels || '';
		checklist = selectedJournal?.checklist || [];
		mood = selectedJournal?.mood || null;
		energyScore = selectedJournal?.energy_score || null;
		disciplineScore = selectedJournal?.discipline_score || null;
		confidenceScore = selectedJournal?.confidence_score || null;
		lessons = toHtml(selectedJournal?.lessons || '');
		tomorrowFocus = toHtml(selectedJournal?.tomorrow_focus || '');
		completionStatus = selectedJournal?.completion_status || 'not_started';
	});

	const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
	const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
	const moodLabels = ['แย่มาก', 'แย่', 'ปานกลาง', 'ดี', 'ดีมาก'];

	const calendarDays = $derived.by(() => {
		const firstDay = new Date(year, month - 1, 1).getDay();
		const daysInMonth = new Date(year, month, 0).getDate();
		const days: { day: number; date: string; profit?: number; trades?: number; hasJournal: boolean; completion?: string }[] = [];

		for (let i = 0; i < firstDay; i++) {
			days.push({ day: 0, date: '', hasJournal: false });
		}

		const journalMap = new Map((journals || []).map((journal: DailyJournal) => [journal.date, journal]));
		const dailyMap = new Map(dailyHistory.map((item: DailyHistoryItem) => [item.date, item]));

		for (let day = 1; day <= daysInMonth; day++) {
			const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			const dayData = dailyMap.get(date);
			const journal = journalMap.get(date) as any;
			days.push({
				day,
				date,
				profit: dayData?.profit,
				trades: dayData?.totalTrades,
				hasJournal: Boolean(journal),
				completion: journal?.completion_status
			});
		}

		return days;
	});

	function navigateMonth(offset: number) {
		let nextMonth = month + offset;
		let nextYear = year;
		if (nextMonth < 1) {
			nextMonth = 12;
			nextYear -= 1;
		}
		if (nextMonth > 12) {
			nextMonth = 1;
			nextYear += 1;
		}
		goto(`/portfolio/journal?year=${nextYear}&month=${nextMonth}`);
	}

	function selectDate(date: string) {
		if (!date) return;
		const params = new URLSearchParams(window.location.search);
		params.set('date', date);
		params.set('year', String(year));
		params.set('month', String(month));
		goto(`/portfolio/journal?${params.toString()}`);
	}

	async function saveJournal() {
		if (!data.account || !selectedDate) return;
		saving = true;
		saved = false;
		actionError = '';

		try {
			const res = await fetch('/api/portfolio/journal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_account_id: data.account.id,
					date: selectedDate,
					pre_market_notes: preMarketNotes,
					post_market_notes: postMarketNotes,
					session_plan: sessionPlan,
					market_bias: marketBias,
					key_levels: keyLevels,
					checklist,
					mood,
					energy_score: energyScore,
					discipline_score: disciplineScore,
					confidence_score: confidenceScore,
					lessons,
					tomorrow_focus: tomorrowFocus,
					completion_status: completionStatus
				})
			});

			if (res.ok) {
				saved = true;
				setTimeout(() => (saved = false), 2000);
			} else {
				actionError = 'ไม่สามารถบันทึก Notebook ได้';
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			saving = false;
		}
	}

	const today = new Date().toISOString().split('T')[0];
</script>

<div class="space-y-6">
	{#if actionError}
		<div class="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center justify-between">
			<span>{actionError}</span>
			<button type="button" onclick={() => actionError = ''} class="text-red-300 hover:text-red-200 text-xs">ปิด</button>
		</div>
	{/if}

	<PortfolioFilterBar
		filters={filterState}
		{filterOptions}
		{tags}
		{playbooks}
		pageKey="journal"
	/>

	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="card">
			<div class="text-xs text-gray-500">รายการ Journal</div>
			<div class="mt-1 text-2xl font-semibold text-white">{journalSummary?.totalEntries || 0}</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">อัตราการเขียน</div>
			<div class="mt-1 text-2xl font-semibold text-green-400">{(journalSummary?.completionRate || 0).toFixed(0)}%</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Streak ปัจจุบัน</div>
			<div class="mt-1 text-2xl font-semibold text-white">{journalSummary?.currentStreak || 0}</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">วันที่เทรด</div>
			<div class="mt-1 text-2xl font-semibold text-white">{journalSummary?.activeTradingDays || 0}</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<div class="card lg:col-span-1">
			<div class="flex items-center justify-between mb-4">
				<button type="button" onclick={() => navigateMonth(-1)} class="text-gray-400 hover:text-white p-2">←</button>
				<h3 class="text-sm font-medium text-white">{monthNames[month - 1]} {year}</h3>
				<button type="button" onclick={() => navigateMonth(1)} class="text-gray-400 hover:text-white p-2">→</button>
			</div>

			<div class="grid grid-cols-7 gap-1 mb-1">
				{#each dayNames as name}
					<div class="text-center text-[10px] text-gray-500 py-1">{name}</div>
				{/each}
			</div>

			<div class="grid grid-cols-7 gap-1">
				{#each calendarDays as cell}
					{#if cell.day === 0}
						<div></div>
					{:else}
						<button
							type="button"
							onclick={() => selectDate(cell.date)}
							class="relative aspect-square flex flex-col items-center justify-center rounded text-xs transition-colors
								{cell.date === selectedDate ? 'bg-brand-primary/20 border border-brand-primary' : ''}
								{cell.date === today ? 'ring-1 ring-brand-primary/50' : ''}
								{cell.profit !== undefined && cell.profit > 0 ? 'bg-green-500/10 text-green-400' : ''}
								{cell.profit !== undefined && cell.profit < 0 ? 'bg-red-500/10 text-red-400' : ''}
								{cell.profit === undefined ? 'text-gray-500 hover:bg-dark-border/30' : 'hover:bg-dark-border/30'}
							"
						>
							<span class="text-[11px]">{cell.day}</span>
							{#if cell.hasJournal}
								<span class="absolute bottom-0.5">
									{#if cell.completion === 'complete'}
										<span class="w-1.5 h-1.5 rounded-full bg-brand-primary inline-block"></span>
									{:else}
										<span class="w-1.5 h-1.5 rounded-full border border-brand-primary inline-block"></span>
									{/if}
								</span>
							{/if}
						</button>
					{/if}
				{/each}
			</div>
		</div>

		<div class="lg:col-span-2 space-y-4">
			{#if !selectedDate}
				<div class="card text-center py-12">
					<p class="text-gray-500 text-sm">เลือกวันจากปฏิทินเพื่อเขียน Notebook</p>
				</div>
			{:else}
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h3 class="text-sm font-medium text-white">
						Notebook: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
					</h3>
					<div class="flex items-center gap-2 flex-wrap">
						<button
							type="button"
							onclick={() => (showTemplates = true)}
							class="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-dark-border text-gray-400 hover:text-white hover:border-brand-primary/50 transition-colors"
						>
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
							</svg>
							ใช้ Template
						</button>
						<select bind:value={completionStatus} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
							<option value="not_started">ยังไม่เริ่ม</option>
							<option value="in_progress">กำลังเขียน</option>
							<option value="complete">เสร็จสิ้น</option>
						</select>
						{#if saved}
							<span class="text-xs text-green-400">บันทึกแล้ว</span>
						{/if}
					</div>
				</div>

				{@const daySummary = dailyHistory.find((item: DailyHistoryItem) => item.date === selectedDate)}
				{#if daySummary}
					<div class="card p-3 flex flex-wrap items-center gap-4 text-sm">
						<span class="text-gray-400">วันนี้เทรด:</span>
						<span class="text-white">{daySummary.totalTrades} เทรด</span>
						<span class="{daySummary.profit >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">
							{formatCurrency(daySummary.profit)}
						</span>
						<span class="text-gray-400">รีวิวแล้ว {daySummary.reviewedTrades || 0}/{daySummary.totalTrades}</span>
					</div>
				{/if}

				<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">บันทึกก่อนเทรด</h4>
						<TiptapEditor compact content={preMarketNotes} onupdate={(html) => (preMarketNotes = html)} placeholder="วิเคราะห์ตลาดก่อนเทรด..." />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">แผนการเทรด</h4>
						<TiptapEditor compact content={sessionPlan} onupdate={(html) => (sessionPlan = html)} placeholder="แผนการเทรดวันนี้..." />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">มุมมองตลาด</h4>
						<input bind:value={marketBias} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">ระดับราคาสำคัญ</h4>
						<input bind:value={keyLevels} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
				</div>

				<div class="card">
					<ChecklistEditor
						items={checklist}
						label="รายการตรวจสอบ"
						placeholder="เช่น Wait for London open confirmation"
						onchange={(items) => (checklist = items)}
					/>
				</div>

				<div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">อารมณ์</h4>
						<div class="flex flex-wrap gap-1.5">
							{#each moodLabels as label, index}
								<button
									type="button"
									onclick={() => (mood = mood === index + 1 ? null : index + 1)}
									class="px-2 py-1 text-xs rounded-lg border transition-all
										{mood === index + 1
											? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
											: 'border-dark-border text-gray-500 hover:text-gray-300'}"
								>
									{label}
								</button>
							{/each}
						</div>
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">พลังงาน</h4>
						<input type="number" min="1" max="5" bind:value={energyScore} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">วินัย</h4>
						<input type="number" min="1" max="5" bind:value={disciplineScore} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">ความมั่นใจ</h4>
						<input type="number" min="1" max="5" bind:value={confidenceScore} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
				</div>

				<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">บันทึกหลังเทรด</h4>
						<TiptapEditor compact content={postMarketNotes} onupdate={(html) => (postMarketNotes = html)} placeholder="สรุปผลการเทรดวันนี้..." />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">บทเรียน</h4>
						<TiptapEditor compact content={lessons} onupdate={(html) => (lessons = html)} placeholder="บทเรียนที่ได้รับ..." />
					</div>
					<div class="card xl:col-span-2">
						<h4 class="text-xs text-gray-500 mb-2">จุดโฟกัสพรุ่งนี้</h4>
						<TiptapEditor compact content={tomorrowFocus} onupdate={(html) => (tomorrowFocus = html)} placeholder="สิ่งที่จะโฟกัสพรุ่งนี้..." />
					</div>
				</div>

				<div class="card">
					<div class="flex items-center justify-between mb-3">
						<h4 class="text-xs text-gray-500">เทรดของวัน</h4>
						<span class="text-xs text-gray-500">{dayTrades.length} เทรด</span>
					</div>
					{#if dayTrades.length > 0}
						<div class="space-y-2">
							{#each dayTrades as trade}
								<a href={`/portfolio/trades/${trade.id}`} class="flex items-center justify-between rounded-xl bg-dark-bg/30 px-3 py-3 hover:bg-dark-bg/50">
									<div>
										<div class="font-medium text-white">{trade.symbol}</div>
										<div class="text-[11px] text-gray-500">{trade.type} • {formatDateTime(trade.close_time)}</div>
									</div>
									<div class="text-right">
										<ReviewStatusBadge status={getTradeReviewStatus(trade)} />
										<div class="mt-1 text-sm font-semibold {Number(trade.profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}">
											{formatCurrency(trade.profit || 0)}
										</div>
									</div>
								</a>
							{/each}
						</div>
					{:else}
						<EmptyState message="ไม่มี trades ของวันนี้ใน filter ที่เลือก" />
					{/if}
				</div>

				<button type="button" onclick={saveJournal} disabled={saving} class="btn-primary text-sm py-2 px-6 disabled:opacity-50">
					{saving ? 'กำลังบันทึก...' : 'บันทึก Notebook'}
				</button>
			{/if}
		</div>
	</div>
</div>

<JournalTemplates
	bind:open={showTemplates}
	{dayTrades}
	onApply={applyTemplate}
/>
