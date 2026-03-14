<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency } from '$lib/utils';

	let { data } = $props();
	let account = $derived(data.account);
	let journals = $derived(data.journals || []);
	let dailyHistory = $derived(data.dailyHistory || []);
	let selectedDate = $derived(data.selectedDate || '');
	let selectedJournal = $derived(data.selectedJournal);
	let year: number = $derived(data.year || new Date().getFullYear());
	let month: number = $derived(data.month || new Date().getMonth() + 1);

	// Journal form state
	let preMarketNotes = $state('');
	let postMarketNotes = $state('');
	let mood = $state<number | null>(null);
	let saving = $state(false);
	let saved = $state(false);

	// Update form when selected journal changes
	$effect(() => {
		preMarketNotes = selectedJournal?.pre_market_notes || '';
		postMarketNotes = selectedJournal?.post_market_notes || '';
		mood = selectedJournal?.mood || null;
	});

	const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
	const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
	const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];

	// Build calendar days for the month
	const calendarDays = $derived(() => {
		const firstDay = new Date(year, month - 1, 1).getDay();
		const daysInMonth = new Date(year, month, 0).getDate();
		const days: { day: number; date: string; profit?: number; trades?: number; hasJournal: boolean }[] = [];

		// Empty cells before first day
		for (let i = 0; i < firstDay; i++) {
			days.push({ day: 0, date: '', hasJournal: false });
		}

		const journalDates = new Set((journals || []).map((j: any) => j.date));
		const dailyMap = new Map(dailyHistory.map((d: any) => [d.date, d]));

		for (let d = 1; d <= daysInMonth; d++) {
			const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			const dayData = dailyMap.get(dateStr);
			days.push({
				day: d,
				date: dateStr,
				profit: dayData?.profit,
				trades: dayData?.totalTrades,
				hasJournal: journalDates.has(dateStr)
			});
		}

		return days;
	});

	function navigateMonth(offset: number) {
		let newMonth = month + offset;
		let newYear = year;
		if (newMonth < 1) { newMonth = 12; newYear--; }
		if (newMonth > 12) { newMonth = 1; newYear++; }
		goto(`/portfolio/journal?year=${newYear}&month=${newMonth}`);
	}

	function selectDate(dateStr: string) {
		if (!dateStr) return;
		goto(`/portfolio/journal?year=${year}&month=${month}&date=${dateStr}`);
	}

	async function saveJournal() {
		if (!account || !selectedDate) return;
		saving = true;
		saved = false;

		try {
			const res = await fetch('/api/portfolio/journal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_account_id: account.id,
					date: selectedDate,
					pre_market_notes: preMarketNotes,
					post_market_notes: postMarketNotes,
					mood
				})
			});

			if (res.ok) {
				saved = true;
				setTimeout(() => saved = false, 2000);
			}
		} finally {
			saving = false;
		}
	}

	const today = new Date().toISOString().split('T')[0];
</script>

<div class="space-y-6">
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Calendar -->
		<div class="card lg:col-span-1">
			<div class="flex items-center justify-between mb-4">
				<button type="button" onclick={() => navigateMonth(-1)} class="text-gray-400 hover:text-white p-1">←</button>
				<h3 class="text-sm font-medium text-white">{monthNames[month - 1]} {year}</h3>
				<button type="button" onclick={() => navigateMonth(1)} class="text-gray-400 hover:text-white p-1">→</button>
			</div>

			<!-- Day headers -->
			<div class="grid grid-cols-7 gap-1 mb-1">
				{#each dayNames as name}
					<div class="text-center text-[10px] text-gray-500 py-1">{name}</div>
				{/each}
			</div>

			<!-- Calendar grid -->
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
								{cell.date === today ? 'ring-1 ring-blue-500/50' : ''}
								{cell.profit !== undefined && cell.profit > 0 ? 'bg-green-500/10 text-green-400' : ''}
								{cell.profit !== undefined && cell.profit < 0 ? 'bg-red-500/10 text-red-400' : ''}
								{cell.profit === undefined ? 'text-gray-500 hover:bg-dark-border/30' : 'hover:bg-dark-border/30'}
							"
						>
							<span class="text-[11px]">{cell.day}</span>
							{#if cell.hasJournal}
								<span class="absolute bottom-0.5 text-[8px]">📝</span>
							{/if}
						</button>
					{/if}
				{/each}
			</div>

			<!-- Legend -->
			<div class="flex items-center gap-3 mt-3 text-[10px] text-gray-500">
				<span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-green-500/30"></span> กำไร</span>
				<span class="flex items-center gap-1"><span class="w-2 h-2 rounded bg-red-500/30"></span> ขาดทุน</span>
				<span>📝 มี Journal</span>
			</div>
		</div>

		<!-- Journal Editor -->
		<div class="lg:col-span-2 space-y-4">
			{#if !selectedDate}
				<div class="card text-center py-12">
					<p class="text-gray-500 text-sm">เลือกวันจากปฏิทินเพื่อเขียน Journal</p>
				</div>
			{:else}
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-white">
						Journal: {new Date(selectedDate + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
					</h3>
					{#if saved}
						<span class="text-xs text-green-400">บันทึกแล้ว!</span>
					{/if}
				</div>

				<!-- Day's trade summary -->
				{@const dayTrades = dailyHistory.find((d: any) => d.date === selectedDate)}
				{#if dayTrades}
					<div class="card p-3 flex items-center gap-4 text-sm">
						<span class="text-gray-400">วันนี้เทรด:</span>
						<span class="text-white">{dayTrades.totalTrades} trades</span>
						<span class="{dayTrades.profit >= 0 ? 'text-green-400' : 'text-red-400'} font-medium">
							{formatCurrency(dayTrades.profit)}
						</span>
					</div>
				{/if}

				<!-- Mood -->
				<div class="card">
					<h4 class="text-xs text-gray-500 mb-2">อารมณ์วันนี้</h4>
					<div class="flex gap-2">
						{#each moodEmojis as emoji, i}
							<button
								type="button"
								onclick={() => mood = mood === i + 1 ? null : i + 1}
								class="text-2xl transition-transform hover:scale-110 {mood === i + 1 ? 'scale-125 opacity-100' : 'opacity-40'}"
							>
								{emoji}
							</button>
						{/each}
					</div>
				</div>

				<!-- Pre-market notes -->
				<div class="card">
					<h4 class="text-xs text-gray-500 mb-2">Pre-Market Notes</h4>
					<textarea
						bind:value={preMarketNotes}
						placeholder="แผนการเทรดวันนี้... bias, key levels, สิ่งที่ต้องระวัง"
						rows="4"
						class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-y"
					></textarea>
				</div>

				<!-- Post-market notes -->
				<div class="card">
					<h4 class="text-xs text-gray-500 mb-2">Post-Market Notes</h4>
					<textarea
						bind:value={postMarketNotes}
						placeholder="สรุปการเทรดวันนี้... อะไรที่ทำได้ดี, อะไรที่ต้องปรับปรุง, บทเรียน"
						rows="4"
						class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-y"
					></textarea>
				</div>

				<button
					type="button"
					onclick={saveJournal}
					disabled={saving}
					class="btn-primary text-sm py-2 px-6 disabled:opacity-50"
				>
					{saving ? 'กำลังบันทึก...' : 'บันทึก Journal'}
				</button>
			{/if}
		</div>
	</div>
</div>
