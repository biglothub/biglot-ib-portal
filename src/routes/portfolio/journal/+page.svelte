<script lang="ts">
	import { goto } from '$app/navigation';
	import PortfolioFilterBar from '$lib/components/portfolio/PortfolioFilterBar.svelte';
	import ChecklistEditor from '$lib/components/portfolio/ChecklistEditor.svelte';
	import ReviewStatusBadge from '$lib/components/portfolio/ReviewStatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatDateTime } from '$lib/utils';
	import { getTradeReviewStatus } from '$lib/portfolio';

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

	$effect(() => {
		preMarketNotes = selectedJournal?.pre_market_notes || '';
		postMarketNotes = selectedJournal?.post_market_notes || '';
		sessionPlan = selectedJournal?.session_plan || '';
		marketBias = selectedJournal?.market_bias || '';
		keyLevels = selectedJournal?.key_levels || '';
		checklist = selectedJournal?.checklist || [];
		mood = selectedJournal?.mood || null;
		energyScore = selectedJournal?.energy_score || null;
		disciplineScore = selectedJournal?.discipline_score || null;
		confidenceScore = selectedJournal?.confidence_score || null;
		lessons = selectedJournal?.lessons || '';
		tomorrowFocus = selectedJournal?.tomorrow_focus || '';
		completionStatus = selectedJournal?.completion_status || 'not_started';
	});

	const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
	const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
	const moodLabels = ['Very Low', 'Low', 'Neutral', 'Good', 'Excellent'];

	const calendarDays = $derived(() => {
		const firstDay = new Date(year, month - 1, 1).getDay();
		const daysInMonth = new Date(year, month, 0).getDate();
		const days: { day: number; date: string; profit?: number; trades?: number; hasJournal: boolean; completion?: string }[] = [];

		for (let i = 0; i < firstDay; i++) {
			days.push({ day: 0, date: '', hasJournal: false });
		}

		const journalMap = new Map((journals || []).map((journal: any) => [journal.date, journal]));
		const dailyMap = new Map(dailyHistory.map((item: any) => [item.date, item]));

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
			}
		} finally {
			saving = false;
		}
	}

	const today = new Date().toISOString().split('T')[0];
</script>

<div class="space-y-6">
	<PortfolioFilterBar
		filters={filterState}
		{filterOptions}
		{tags}
		{playbooks}
		pageKey="journal"
	/>

	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="card">
			<div class="text-xs text-gray-500">Journal Entries</div>
			<div class="mt-1 text-2xl font-semibold text-white">{journalSummary?.totalEntries || 0}</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Completion Rate</div>
			<div class="mt-1 text-2xl font-semibold text-green-400">{(journalSummary?.completionRate || 0).toFixed(0)}%</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Current Streak</div>
			<div class="mt-1 text-2xl font-semibold text-white">{journalSummary?.currentStreak || 0}</div>
		</div>
		<div class="card">
			<div class="text-xs text-gray-500">Trading Days</div>
			<div class="mt-1 text-2xl font-semibold text-white">{journalSummary?.activeTradingDays || 0}</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<div class="card lg:col-span-1">
			<div class="flex items-center justify-between mb-4">
				<button type="button" onclick={() => navigateMonth(-1)} class="text-gray-400 hover:text-white p-1">←</button>
				<h3 class="text-sm font-medium text-white">{monthNames[month - 1]} {year}</h3>
				<button type="button" onclick={() => navigateMonth(1)} class="text-gray-400 hover:text-white p-1">→</button>
			</div>

			<div class="grid grid-cols-7 gap-1 mb-1">
				{#each dayNames as name}
					<div class="text-center text-[10px] text-gray-500 py-1">{name}</div>
				{/each}
			</div>

			<div class="grid grid-cols-7 gap-1">
				{#each calendarDays() as cell}
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
				<div class="flex items-center justify-between gap-3">
					<h3 class="text-sm font-medium text-white">
						Notebook: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
					</h3>
					<div class="flex items-center gap-3">
						<select bind:value={completionStatus} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
							<option value="not_started">Not started</option>
							<option value="in_progress">In progress</option>
							<option value="complete">Complete</option>
						</select>
						{#if saved}
							<span class="text-xs text-green-400">บันทึกแล้ว</span>
						{/if}
					</div>
				</div>

				{@const daySummary = dailyHistory.find((item: any) => item.date === selectedDate)}
				{#if daySummary}
					<div class="card p-3 flex flex-wrap items-center gap-4 text-sm">
						<span class="text-gray-400">วันนี้เทรด:</span>
						<span class="text-white">{daySummary.totalTrades} trades</span>
						<span class="{daySummary.profit >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">
							{formatCurrency(daySummary.profit)}
						</span>
						<span class="text-gray-400">Reviewed {daySummary.reviewedTrades || 0}/{daySummary.totalTrades}</span>
					</div>
				{/if}

				<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Pre-Market Notes</h4>
						<textarea bind:value={preMarketNotes} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Session Plan</h4>
						<textarea bind:value={sessionPlan} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Market Bias</h4>
						<input bind:value={marketBias} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Key Levels</h4>
						<input bind:value={keyLevels} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
				</div>

				<div class="card">
					<ChecklistEditor
						items={checklist}
						label="Checklist"
						placeholder="เช่น Wait for London open confirmation"
						onchange={(items) => (checklist = items)}
					/>
				</div>

				<div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Mood</h4>
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
						<h4 class="text-xs text-gray-500 mb-2">Energy</h4>
						<input type="number" min="1" max="5" bind:value={energyScore} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Discipline</h4>
						<input type="number" min="1" max="5" bind:value={disciplineScore} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Confidence</h4>
						<input type="number" min="1" max="5" bind:value={confidenceScore} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white" />
					</div>
				</div>

				<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Post-Market Notes</h4>
						<textarea bind:value={postMarketNotes} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
					</div>
					<div class="card">
						<h4 class="text-xs text-gray-500 mb-2">Lessons</h4>
						<textarea bind:value={lessons} rows="4" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
					</div>
					<div class="card xl:col-span-2">
						<h4 class="text-xs text-gray-500 mb-2">Tomorrow Focus</h4>
						<textarea bind:value={tomorrowFocus} rows="3" class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white"></textarea>
					</div>
				</div>

				<div class="card">
					<div class="flex items-center justify-between mb-3">
						<h4 class="text-xs text-gray-500">Trades of the Day</h4>
						<span class="text-xs text-gray-500">{dayTrades.length} trades</span>
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
