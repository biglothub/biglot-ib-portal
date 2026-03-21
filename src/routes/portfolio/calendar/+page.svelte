<script lang="ts">
	import { onMount } from 'svelte';

	interface EconomicEvent {
		id: string;
		title: string;
		country: string;
		date: string;
		time: string;
		impact: 'High' | 'Medium' | 'Low' | 'Holiday';
		forecast: string;
		previous: string;
		actual: string;
	}

	let events = $state<EconomicEvent[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedWeek = $state<'lastweek' | 'thisweek' | 'nextweek'>('thisweek');

	// Filters
	let filterImpact = $state<'all' | 'High' | 'Medium' | 'Low' | 'Holiday'>('all');
	let filterCountry = $state('all');
	let searchQuery = $state('');

	// Country flag mapping
	const countryFlags: Record<string, string> = {
		USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
		CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳', INR: '🇮🇳',
		SGD: '🇸🇬', HKD: '🇭🇰', KRW: '🇰🇷', BRL: '🇧🇷', MXN: '🇲🇽',
		ZAR: '🇿🇦', SEK: '🇸🇪', NOK: '🇳🇴', DKK: '🇩🇰', PLN: '🇵🇱',
		TRY: '🇹🇷', RUB: '🇷🇺', ALL: '🌍'
	};

	const impactColors: Record<string, string> = {
		High: 'bg-red-500/20 text-red-400 border-red-500/30',
		Medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
		Low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
		Holiday: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
	};

	const impactDots: Record<string, string> = {
		High: 'bg-red-500',
		Medium: 'bg-amber-500',
		Low: 'bg-blue-500',
		Holiday: 'bg-purple-500'
	};

	const weekLabels: Record<string, string> = {
		lastweek: 'สัปดาห์ที่แล้ว',
		thisweek: 'สัปดาห์นี้',
		nextweek: 'สัปดาห์หน้า'
	};

	// Unique countries from current events
	let availableCountries = $derived(
		[...new Set(events.map(e => e.country))].filter(Boolean).sort()
	);

	// Filtered events
	let filteredEvents = $derived(
		events.filter(e => {
			if (filterImpact !== 'all' && e.impact !== filterImpact) return false;
			if (filterCountry !== 'all' && e.country !== filterCountry) return false;
			if (searchQuery) {
				const q = searchQuery.toLowerCase();
				return e.title.toLowerCase().includes(q) || e.country.toLowerCase().includes(q);
			}
			return true;
		})
	);

	// Group filtered events by date
	let groupedByDate = $derived.by(() => {
		const groups: Record<string, EconomicEvent[]> = {};
		for (const e of filteredEvents) {
			const key = e.date || 'Unknown';
			if (!groups[key]) groups[key] = [];
			groups[key].push(e);
		}
		return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
	});

	// Stats
	let stats = $derived({
		total: filteredEvents.length,
		high: filteredEvents.filter(e => e.impact === 'High').length,
		medium: filteredEvents.filter(e => e.impact === 'Medium').length,
		low: filteredEvents.filter(e => e.impact === 'Low').length
	});

	async function fetchEvents() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/portfolio/economic-calendar?week=${selectedWeek}`);
			if (!res.ok) {
				error = 'ไม่สามารถโหลดข้อมูลได้';
				return;
			}
			const data = await res.json();
			events = data.events || [];
		} catch {
			error = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		// Re-fetch when week changes
		selectedWeek;
		fetchEvents();
	});

	function formatDate(dateStr: string): string {
		try {
			const d = new Date(dateStr);
			if (isNaN(d.getTime())) return dateStr;
			return d.toLocaleDateString('th-TH', {
				weekday: 'long',
				day: 'numeric',
				month: 'short',
				year: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	function isToday(dateStr: string): boolean {
		try {
			const d = new Date(dateStr);
			const today = new Date();
			return d.toDateString() === today.toDateString();
		} catch {
			return false;
		}
	}
</script>

<svelte:head>
	<title>ปฏิทินเศรษฐกิจ | IB Portal</title>
</svelte:head>

<div class="min-h-screen p-4 md:p-6 space-y-4 md:space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<div>
			<h1 class="text-xl md:text-2xl font-bold text-white">ปฏิทินเศรษฐกิจ</h1>
			<p class="text-sm text-gray-400 mt-1">ปฏิทินเศรษฐกิจ — ข่าวสารและเหตุการณ์สำคัญ</p>
		</div>

		<!-- Week Selector -->
		<div class="flex items-center gap-1 bg-dark-surface border border-dark-border rounded-lg p-1">
			{#each (['lastweek', 'thisweek', 'nextweek'] as const) as week}
				<button
					class="px-3 py-1.5 text-sm rounded-md transition-colors {selectedWeek === week
						? 'bg-brand-primary text-white'
						: 'text-gray-400 hover:text-white hover:bg-white/5'}"
					onclick={() => (selectedWeek = week)}
				>
					{weekLabels[week]}
				</button>
			{/each}
		</div>
	</div>

	<!-- Stats Bar -->
	<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
		<div class="bg-dark-surface border border-dark-border rounded-lg p-3">
			<p class="text-xs text-gray-400">ทั้งหมด</p>
			<p class="text-lg font-bold text-white">{stats.total}</p>
		</div>
		<div class="bg-dark-surface border border-dark-border rounded-lg p-3">
			<p class="text-xs text-gray-400">ผลกระทบสูง</p>
			<p class="text-lg font-bold text-red-400">{stats.high}</p>
		</div>
		<div class="bg-dark-surface border border-dark-border rounded-lg p-3">
			<p class="text-xs text-gray-400">ผลกระทบปานกลาง</p>
			<p class="text-lg font-bold text-amber-400">{stats.medium}</p>
		</div>
		<div class="bg-dark-surface border border-dark-border rounded-lg p-3">
			<p class="text-xs text-gray-400">ผลกระทบต่ำ</p>
			<p class="text-lg font-bold text-blue-400">{stats.low}</p>
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-3">
		<!-- Search -->
		<div class="relative flex-1">
			<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				type="text"
				placeholder="ค้นหาเหตุการณ์..."
				bind:value={searchQuery}
				class="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary"
			/>
		</div>

		<!-- Impact Filter -->
		<select
			bind:value={filterImpact}
			class="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-primary"
		>
			<option value="all">ทุกระดับผลกระทบ</option>
			<option value="High">สูง (High)</option>
			<option value="Medium">ปานกลาง (Medium)</option>
			<option value="Low">ต่ำ (Low)</option>
			<option value="Holiday">วันหยุด (Holiday)</option>
		</select>

		<!-- Country Filter -->
		<select
			bind:value={filterCountry}
			class="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-white focus:outline-none focus:border-brand-primary"
		>
			<option value="all">ทุกประเทศ</option>
			{#each availableCountries as country}
				<option value={country}>{countryFlags[country] || ''} {country}</option>
			{/each}
		</select>

		<!-- Refresh -->
		<button
			onclick={() => fetchEvents()}
			disabled={loading}
			aria-label="รีเฟรชข้อมูล"
			class="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm text-gray-400 hover:text-white hover:border-brand-primary transition-colors disabled:opacity-50"
		>
			<svg class="w-4 h-4 {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
		</button>
	</div>

	<!-- Content -->
	{#if loading}
		<!-- Loading Skeleton -->
		<div class="space-y-4">
			{#each Array(3) as _}
				<div class="bg-dark-surface border border-dark-border rounded-lg p-4 animate-pulse">
					<div class="h-5 bg-dark-border/50 rounded w-48 mb-4"></div>
					<div class="space-y-3">
						{#each Array(4) as __}
							<div class="flex gap-4">
								<div class="h-4 bg-dark-border/30 rounded w-16"></div>
								<div class="h-4 bg-dark-border/30 rounded w-12"></div>
								<div class="h-4 bg-dark-border/30 rounded flex-1"></div>
								<div class="h-4 bg-dark-border/30 rounded w-16"></div>
								<div class="h-4 bg-dark-border/30 rounded w-16"></div>
								<div class="h-4 bg-dark-border/30 rounded w-16"></div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else if error}
		<!-- Error State -->
		<div class="bg-dark-surface border border-red-500/30 rounded-lg p-8 text-center">
			<svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
			</svg>
			<p class="text-red-400 font-medium">{error}</p>
			<button onclick={() => fetchEvents()} class="mt-3 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors">
				ลองใหม่
			</button>
		</div>
	{:else if filteredEvents.length === 0}
		<!-- Empty State -->
		<div class="bg-dark-surface border border-dark-border rounded-lg p-8 text-center">
			<svg class="w-12 h-12 text-gray-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
			</svg>
			<p class="text-gray-400 font-medium">ไม่พบเหตุการณ์</p>
			<p class="text-gray-500 text-sm mt-1">
				{#if filterImpact !== 'all' || filterCountry !== 'all' || searchQuery}
					ลองปรับตัวกรองใหม่
				{:else}
					ยังไม่มีข้อมูลสำหรับ{weekLabels[selectedWeek]}
				{/if}
			</p>
		</div>
	{:else}
		<!-- Events grouped by date -->
		<div class="space-y-4">
			{#each groupedByDate as [date, dayEvents]}
				<div class="bg-dark-surface border border-dark-border rounded-lg overflow-hidden {isToday(date) ? 'ring-1 ring-brand-primary/50' : ''}">
					<!-- Date Header -->
					<div class="px-4 py-3 border-b border-dark-border flex items-center gap-2 {isToday(date) ? 'bg-brand-primary/10' : 'bg-white/[0.02]'}">
						<svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
						<h3 class="font-semibold text-white text-sm">{formatDate(date)}</h3>
						{#if isToday(date)}
							<span class="px-2 py-0.5 text-xs bg-brand-primary/20 text-brand-primary rounded-full">วันนี้</span>
						{/if}
						<span class="text-xs text-gray-500 ml-auto">{dayEvents.length} เหตุการณ์</span>
					</div>

					<!-- Desktop Table -->
					<div class="hidden md:block overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="text-xs text-gray-500 border-b border-dark-border">
									<th class="px-4 py-2 text-left font-medium w-20">เวลา</th>
									<th class="px-4 py-2 text-left font-medium w-16">สกุลเงิน</th>
									<th class="px-4 py-2 text-left font-medium w-24">ผลกระทบ</th>
									<th class="px-4 py-2 text-left font-medium">เหตุการณ์</th>
									<th class="px-4 py-2 text-right font-medium w-24">คาดการณ์</th>
									<th class="px-4 py-2 text-right font-medium w-24">ครั้งก่อน</th>
									<th class="px-4 py-2 text-right font-medium w-24">จริง</th>
								</tr>
							</thead>
							<tbody>
								{#each dayEvents as event}
									<tr class="border-b border-dark-border/50 hover:bg-white/[0.02] transition-colors">
										<td class="px-4 py-2.5 text-gray-300 font-mono text-xs">{event.time || '—'}</td>
										<td class="px-4 py-2.5">
											<span class="flex items-center gap-1.5">
												<span class="text-base leading-none">{countryFlags[event.country] || ''}</span>
												<span class="text-gray-300 text-xs font-medium">{event.country}</span>
											</span>
										</td>
										<td class="px-4 py-2.5">
											<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border {impactColors[event.impact]}">
												<span class="w-1.5 h-1.5 rounded-full {impactDots[event.impact]}"></span>
												{event.impact}
											</span>
										</td>
										<td class="px-4 py-2.5 text-white font-medium">{event.title}</td>
										<td class="px-4 py-2.5 text-right text-gray-400 font-mono text-xs">{event.forecast || '—'}</td>
										<td class="px-4 py-2.5 text-right text-gray-400 font-mono text-xs">{event.previous || '—'}</td>
										<td class="px-4 py-2.5 text-right font-mono text-xs {event.actual ? 'text-white font-semibold' : 'text-gray-500'}">{event.actual || '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Mobile Cards -->
					<div class="md:hidden divide-y divide-dark-border/50">
						{#each dayEvents as event}
							<div class="p-3 space-y-2">
								<div class="flex items-start justify-between gap-2">
									<div class="flex items-center gap-2 min-w-0">
										<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border {impactColors[event.impact]}">
											<span class="w-1.5 h-1.5 rounded-full {impactDots[event.impact]}"></span>
											{event.impact}
										</span>
										<span class="text-xs text-gray-400 font-mono shrink-0">{event.time || '—'}</span>
									</div>
									<span class="flex items-center gap-1 shrink-0">
										<span class="text-sm">{countryFlags[event.country] || ''}</span>
										<span class="text-xs text-gray-400">{event.country}</span>
									</span>
								</div>
								<p class="text-white text-sm font-medium">{event.title}</p>
								<div class="flex gap-4 text-xs">
									<div>
										<span class="text-gray-500">คาดการณ์</span>
										<span class="text-gray-300 ml-1 font-mono">{event.forecast || '—'}</span>
									</div>
									<div>
										<span class="text-gray-500">ครั้งก่อน</span>
										<span class="text-gray-300 ml-1 font-mono">{event.previous || '—'}</span>
									</div>
									<div>
										<span class="text-gray-500">จริง</span>
										<span class="font-mono ml-1 {event.actual ? 'text-white font-semibold' : 'text-gray-500'}">{event.actual || '—'}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
