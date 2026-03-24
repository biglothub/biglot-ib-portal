<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { buildPortfolioSearchParams, EMPTY_PORTFOLIO_FILTERS } from '$lib/portfolio';
	import type { PortfolioFilterState, TagCategory, PortfolioFilterOptions, TradeTag, Playbook, PortfolioSavedView } from '$lib/types';
	import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';
	import RangeInput from '$lib/components/shared/RangeInput.svelte';
	import DateRangePresets from '$lib/components/shared/DateRangePresets.svelte';
	import ActiveFilterChips from '$lib/components/portfolio/ActiveFilterChips.svelte';

	let {
		filters = EMPTY_PORTFOLIO_FILTERS,
		filterOptions,
		tags = [],
		playbooks = [],
		savedViews = [],
		pageKey = 'trades'
	}: {
		filters?: PortfolioFilterState;
		filterOptions: PortfolioFilterOptions;
		tags?: TradeTag[];
		playbooks?: Playbook[];
		savedViews?: PortfolioSavedView[];
		pageKey?: string;
	} = $props();

	// --- State for all filter fields ---
	let q = $state('');
	let from = $state('');
	let to = $state('');
	let symbols = $state<string[]>([]);
	let sessions = $state<string[]>([]);
	let directions = $state<string[]>([]);
	let tagIds = $state<string[]>([]);
	let playbookIds = $state<string[]>([]);
	let reviewStatus = $state<string[]>([]);
	let outcome = $state('');
	let hasNotes = $state('');
	let hasAttachments = $state('');
	let durationBucket = $state('');
	// New filters
	let profitMin = $state<number | null>(null);
	let profitMax = $state<number | null>(null);
	let lotSizeMin = $state<number | null>(null);
	let lotSizeMax = $state<number | null>(null);
	let pipsMin = $state<number | null>(null);
	let pipsMax = $state<number | null>(null);
	let qualityScoreMin = $state<number | null>(null);
	let qualityScoreMax = $state<number | null>(null);
	let disciplineScoreMin = $state<number | null>(null);
	let disciplineScoreMax = $state<number | null>(null);
	let executionScoreMin = $state<number | null>(null);
	let executionScoreMax = $state<number | null>(null);
	let confidenceMin = $state<number | null>(null);
	let confidenceMax = $state<number | null>(null);
	let followedPlan = $state('');
	let hasBrokenRules = $state('');
	let dayOfWeek = $state<number[]>([]);

	// UI state
	let expanded = $state(false);
	let showMobileSheet = $state(false);
	let autoApply = $state(browser ? localStorage.getItem('portfolio-filter-auto-apply') === '1' : false);
	let applyTimer: ReturnType<typeof setTimeout> | undefined;

	// Section collapse state
	let sectionOpen = $state<Record<string, boolean>>({
		basic: true,
		time: false,
		performance: false,
		review: false,
		scores: false,
		tags: false
	});

	const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
		setup: 'เซ็ตอัพ',
		execution: 'การเข้าออก',
		emotion: 'อารมณ์',
		mistake: 'ความผิดพลาด',
		market_condition: 'สภาพตลาด',
		custom: 'กำหนดเอง'
	};

	const DOW_OPTIONS: { value: number; label: string; disabled?: boolean }[] = [
		{ value: 1, label: 'จ' },
		{ value: 2, label: 'อ' },
		{ value: 3, label: 'พ' },
		{ value: 4, label: 'พฤ' },
		{ value: 5, label: 'ศ' },
		{ value: 6, label: 'ส', disabled: true },
		{ value: 0, label: 'อา', disabled: true }
	];

	let activeCount = $derived(
		(q ? 1 : 0) +
		(from ? 1 : 0) +
		(to ? 1 : 0) +
		(outcome ? 1 : 0) +
		symbols.length +
		sessions.length +
		directions.length +
		tagIds.length +
		playbookIds.length +
		reviewStatus.length +
		(hasNotes !== '' ? 1 : 0) +
		(hasAttachments !== '' ? 1 : 0) +
		(durationBucket ? 1 : 0) +
		(profitMin != null ? 1 : 0) + (profitMax != null ? 1 : 0) +
		(lotSizeMin != null ? 1 : 0) + (lotSizeMax != null ? 1 : 0) +
		(pipsMin != null ? 1 : 0) + (pipsMax != null ? 1 : 0) +
		(qualityScoreMin != null ? 1 : 0) + (qualityScoreMax != null ? 1 : 0) +
		(disciplineScoreMin != null ? 1 : 0) + (disciplineScoreMax != null ? 1 : 0) +
		(executionScoreMin != null ? 1 : 0) + (executionScoreMax != null ? 1 : 0) +
		(confidenceMin != null ? 1 : 0) + (confidenceMax != null ? 1 : 0) +
		(followedPlan ? 1 : 0) +
		(hasBrokenRules ? 1 : 0) +
		dayOfWeek.length
	);

	// Build current filter state from local state
	function getCurrentFilterState(): PortfolioFilterState {
		return {
			q,
			from,
			to,
			symbols,
			sessions,
			directions,
			tagIds,
			playbookIds,
			reviewStatus: reviewStatus as any,
			outcome: outcome as any,
			hasNotes: hasNotes === '' ? null : hasNotes === '1',
			hasAttachments: hasAttachments === '' ? null : hasAttachments === '1',
			durationBucket: durationBucket as any,
			profitMin,
			profitMax,
			lotSizeMin,
			lotSizeMax,
			pipsMin,
			pipsMax,
			qualityScoreMin,
			qualityScoreMax,
			disciplineScoreMin,
			disciplineScoreMax,
			executionScoreMin,
			executionScoreMax,
			confidenceMin,
			confidenceMax,
			followedPlan: followedPlan as any,
			hasBrokenRules: hasBrokenRules as any,
			dayOfWeek
		};
	}

	// Sync from prop
	$effect(() => {
		q = filters.q || '';
		from = filters.from || '';
		to = filters.to || '';
		symbols = [...(filters.symbols || [])];
		sessions = [...(filters.sessions || [])];
		directions = [...(filters.directions || [])];
		tagIds = [...(filters.tagIds || [])];
		playbookIds = [...(filters.playbookIds || [])];
		reviewStatus = [...(filters.reviewStatus || [])];
		outcome = filters.outcome || '';
		hasNotes = filters.hasNotes == null ? '' : filters.hasNotes ? '1' : '0';
		hasAttachments = filters.hasAttachments == null ? '' : filters.hasAttachments ? '1' : '0';
		durationBucket = filters.durationBucket || '';
		profitMin = filters.profitMin ?? null;
		profitMax = filters.profitMax ?? null;
		lotSizeMin = filters.lotSizeMin ?? null;
		lotSizeMax = filters.lotSizeMax ?? null;
		pipsMin = filters.pipsMin ?? null;
		pipsMax = filters.pipsMax ?? null;
		qualityScoreMin = filters.qualityScoreMin ?? null;
		qualityScoreMax = filters.qualityScoreMax ?? null;
		disciplineScoreMin = filters.disciplineScoreMin ?? null;
		disciplineScoreMax = filters.disciplineScoreMax ?? null;
		executionScoreMin = filters.executionScoreMin ?? null;
		executionScoreMax = filters.executionScoreMax ?? null;
		confidenceMin = filters.confidenceMin ?? null;
		confidenceMax = filters.confidenceMax ?? null;
		followedPlan = filters.followedPlan || '';
		hasBrokenRules = filters.hasBrokenRules || '';
		dayOfWeek = [...(filters.dayOfWeek || [])];
	});

	function applyFilters(next?: Partial<PortfolioFilterState>) {
		const state = { ...getCurrentFilterState(), ...next };
		const params = buildPortfolioSearchParams(state);
		goto(`${$page.url.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
	}

	function clearFilters() {
		goto($page.url.pathname);
	}

	function autoApplyNow() {
		if (autoApply) {
			clearTimeout(applyTimer);
			applyTimer = setTimeout(() => applyFilters(), 0);
		}
	}

	function autoApplyDebounced() {
		if (autoApply) {
			clearTimeout(applyTimer);
			applyTimer = setTimeout(() => applyFilters(), 500);
		}
	}

	function toggleAutoApply() {
		autoApply = !autoApply;
		if (browser) localStorage.setItem('portfolio-filter-auto-apply', autoApply ? '1' : '0');
	}

	function toggleDow(day: number) {
		if (dayOfWeek.includes(day)) {
			dayOfWeek = dayOfWeek.filter((d) => d !== day);
		} else {
			dayOfWeek = [...dayOfWeek, day];
		}
		autoApplyNow();
	}

	function handleChipRemove(key: string, value?: string) {
		switch (key) {
			case 'q': q = ''; break;
			case 'dateRange': case 'from': from = ''; if (key === 'dateRange') to = ''; break;
			case 'to': to = ''; break;
			case 'symbols': symbols = symbols.filter((s) => s !== value); break;
			case 'sessions': sessions = sessions.filter((s) => s !== value); break;
			case 'directions': directions = directions.filter((d) => d !== value); break;
			case 'reviewStatus': reviewStatus = reviewStatus.filter((r) => r !== value); break;
			case 'tagIds': tagIds = tagIds.filter((t) => t !== value); break;
			case 'playbookIds': playbookIds = playbookIds.filter((p) => p !== value); break;
			case 'outcome': outcome = ''; break;
			case 'hasNotes': hasNotes = ''; break;
			case 'hasAttachments': hasAttachments = ''; break;
			case 'durationBucket': durationBucket = ''; break;
			case 'profitRange': profitMin = null; profitMax = null; break;
			case 'lotSizeRange': lotSizeMin = null; lotSizeMax = null; break;
			case 'pipsRange': pipsMin = null; pipsMax = null; break;
			case 'qualityScoreRange': qualityScoreMin = null; qualityScoreMax = null; break;
			case 'disciplineScoreRange': disciplineScoreMin = null; disciplineScoreMax = null; break;
			case 'executionScoreRange': executionScoreMin = null; executionScoreMax = null; break;
			case 'confidenceRange': confidenceMin = null; confidenceMax = null; break;
			case 'followedPlan': followedPlan = ''; break;
			case 'hasBrokenRules': hasBrokenRules = ''; break;
			case 'dayOfWeek': dayOfWeek = dayOfWeek.filter((d) => d !== Number(value)); break;
		}
		applyFilters();
	}

	async function saveView() {
		if (!(pageKey === 'trades' || pageKey === 'analytics')) return;
		const name = window.prompt('ตั้งชื่อ saved view');
		if (!name) return;
		await fetch('/api/portfolio/saved-views', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ page: pageKey, name, filters: getCurrentFilterState() })
		});
		await invalidate('portfolio:baseData');
	}

	async function deleteView(id: string) {
		await fetch('/api/portfolio/saved-views', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		await invalidate('portfolio:baseData');
	}

	function toggleSection(key: string) {
		sectionOpen[key] = !sectionOpen[key];
	}

	function openFilters() {
		if (window.innerWidth < 768) {
			showMobileSheet = true;
		} else {
			expanded = !expanded;
		}
	}

	// Tag options with grouping
	let tagOptions = $derived(
		tags.map((t: TradeTag) => ({
			value: t.id,
			label: t.name,
			group: TAG_CATEGORY_LABELS[t.category as TagCategory] || 'อื่นๆ',
			color: t.color
		}))
	);
</script>

<div class="card space-y-3">
	<!-- Quick filters: Search + Date presets (always visible) -->
	<div class="space-y-3">
		<div class="flex items-center gap-2">
			<div class="relative flex-1">
				<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
				<input
					type="text"
					bind:value={q}
					oninput={() => autoApplyDebounced()}
					placeholder="ค้นหา symbol, notes, lesson, tags..."
					aria-label="ค้นหา"
					class="w-full bg-dark-bg border border-dark-border rounded pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600"
				/>
			</div>
			<button
				type="button"
				onclick={openFilters}
				aria-expanded={expanded}
				aria-controls="filter-panel"
				class="flex items-center gap-1.5 px-3 py-2 rounded border text-sm transition-colors
					{activeCount > 0
						? 'border-brand-primary/30 bg-brand-primary/10 text-brand-primary'
						: 'border-dark-border bg-dark-bg text-gray-400 hover:text-white'}"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
				</svg>
				<span class="hidden sm:inline">ตัวกรอง</span>
				{#if activeCount > 0}
					<span class="inline-flex items-center justify-center rounded-full bg-brand-primary/20 text-brand-primary text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px]">
						{activeCount}
					</span>
				{/if}
			</button>
		</div>

		<DateRangePresets bind:from bind:to onchange={() => autoApplyNow()} />

		<ActiveFilterChips
			filters={getCurrentFilterState()}
			{filterOptions}
			{tags}
			{playbooks}
			onremove={handleChipRemove}
			onclear={clearFilters}
		/>
	</div>

	<!-- Saved views -->
	{#if savedViews.length > 0}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="text-[10px] text-gray-400 mr-0.5">มุมมอง:</span>
			{#each savedViews as view}
				<div class="inline-flex items-center gap-1 rounded-full border border-dark-border bg-dark-bg/40 px-2.5 py-1 text-[11px] text-gray-300">
					<button type="button" onclick={() => applyFilters(view.filters)} class="hover:text-white">
						{view.name}
					</button>
					<button type="button" onclick={() => deleteView(view.id)} class="text-red-300 hover:text-red-200">&times;</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Expanded filter panel (desktop) -->
	{#if expanded}
		<div id="filter-panel" class="space-y-3 border-t border-dark-border pt-3" role="region" aria-label="ตัวกรองเพิ่มเติม">
			<!-- Action bar -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<h3 class="text-xs font-medium text-gray-400">ตัวกรองเพิ่มเติม</h3>
					<!-- Auto-apply toggle -->
					<button
						type="button"
						onclick={toggleAutoApply}
						class="flex items-center gap-1.5 text-[11px] {autoApply ? 'text-brand-primary' : 'text-gray-400 hover:text-gray-400'}"
						aria-pressed={autoApply}
					>
						<span class="w-7 h-4 rounded-full transition-colors relative {autoApply ? 'bg-brand-primary/30' : 'bg-dark-border'}">
							<span class="absolute top-0.5 w-3 h-3 rounded-full transition-all {autoApply ? 'left-3.5 bg-brand-primary' : 'left-0.5 bg-gray-500'}"></span>
						</span>
						อัตโนมัติ
					</button>
				</div>
				<div class="flex items-center gap-2">
					{#if pageKey === 'trades' || pageKey === 'analytics'}
						<button type="button" onclick={saveView} class="text-[11px] text-brand-primary hover:text-brand-primary/80">
							บันทึกมุมมอง
						</button>
					{/if}
					<button type="button" onclick={clearFilters} class="text-[11px] text-gray-400 hover:text-white">ล้าง</button>
					{#if !autoApply}
						<button type="button" onclick={() => applyFilters()} class="btn-primary text-xs px-3 py-1.5">ใช้งาน</button>
					{/if}
				</div>
			</div>

			<!-- Section: พื้นฐาน -->
			<div role="group" aria-label="ตัวกรองพื้นฐาน">
				<button type="button" onclick={() => toggleSection('basic')} class="flex items-center gap-1.5 w-full text-left mb-2" aria-expanded={sectionOpen.basic}>
					<svg class="w-3.5 h-3.5 text-gray-400 transition-transform {sectionOpen.basic ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7" /></svg>
					<span class="text-xs font-medium text-gray-300">พื้นฐาน</span>
				</button>
				{#if sectionOpen.basic}
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pl-5">
						<MultiSelectDropdown
							label="สัญลักษณ์"
							options={(filterOptions.symbols || []).map((s: string) => ({ value: s, label: s }))}
							bind:selected={symbols}
							searchable={true}
							showSelectAll={true}
							onchange={() => autoApplyNow()}
						/>
						<MultiSelectDropdown
							label="ทิศทาง"
							options={[
								{ value: 'BUY', label: 'BUY' },
								{ value: 'SELL', label: 'SELL' }
							]}
							bind:selected={directions}
							onchange={() => autoApplyNow()}
						/>
						<MultiSelectDropdown
							label="เซสชัน"
							options={[
								{ value: 'asian', label: 'เอเชีย' },
								{ value: 'london', label: 'ลอนดอน' },
								{ value: 'newyork', label: 'นิวยอร์ก' }
							]}
							bind:selected={sessions}
							onchange={() => autoApplyNow()}
						/>
						<select bind:value={outcome} onchange={() => autoApplyNow()} aria-label="ผลลัพธ์" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
							<option value="">ผลลัพธ์ทั้งหมด</option>
							<option value="win">กำไร</option>
							<option value="loss">ขาดทุน</option>
							<option value="breakeven">เสมอตัว</option>
						</select>
						<select bind:value={durationBucket} onchange={() => autoApplyNow()} aria-label="ระยะเวลา" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
							<option value="">ระยะเวลาทั้งหมด</option>
							{#each filterOptions.durationBuckets || [] as bucket}
								<option value={bucket.value}>{bucket.label}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>

			<!-- Section: ช่วงเวลา -->
			<div role="group" aria-label="ตัวกรองช่วงเวลา">
				<button type="button" onclick={() => toggleSection('time')} class="flex items-center gap-1.5 w-full text-left mb-2" aria-expanded={sectionOpen.time}>
					<svg class="w-3.5 h-3.5 text-gray-400 transition-transform {sectionOpen.time ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7" /></svg>
					<span class="text-xs font-medium text-gray-300">ช่วงเวลา</span>
				</button>
				{#if sectionOpen.time}
					<div class="pl-5 space-y-3">
						<div class="flex items-center gap-2">
							<input type="date" bind:value={from} onchange={() => autoApplyNow()} aria-label="วันที่เริ่ม" class="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
							<span class="text-gray-400 text-xs">ถึง</span>
							<input type="date" bind:value={to} onchange={() => autoApplyNow()} aria-label="วันที่สิ้นสุด" class="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
						</div>
						<div class="space-y-1">
							<span class="text-xs text-gray-400">วันในสัปดาห์</span>
							<div class="flex items-center gap-1">
								{#each DOW_OPTIONS as dow}
									<button
										type="button"
										disabled={dow.disabled}
										onclick={() => !dow.disabled && toggleDow(dow.value)}
										class="w-8 h-8 rounded text-xs font-medium transition-colors
											{dow.disabled
												? 'bg-dark-bg/30 text-gray-700 cursor-not-allowed'
												: dayOfWeek.includes(dow.value)
													? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30'
													: 'bg-dark-bg border border-dark-border text-gray-400 hover:text-white'}"
										aria-pressed={dayOfWeek.includes(dow.value)}
									>
										{dow.label}
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Section: ผลการเทรด -->
			<div role="group" aria-label="ตัวกรองผลการเทรด">
				<button type="button" onclick={() => toggleSection('performance')} class="flex items-center gap-1.5 w-full text-left mb-2" aria-expanded={sectionOpen.performance}>
					<svg class="w-3.5 h-3.5 text-gray-400 transition-transform {sectionOpen.performance ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7" /></svg>
					<span class="text-xs font-medium text-gray-300">ผลการเทรด</span>
				</button>
				{#if sectionOpen.performance}
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pl-5">
						<RangeInput
							label="P&L"
							unit="$"
							bind:min={profitMin}
							bind:max={profitMax}
							step={0.01}
							placeholderMin={filterOptions.profitRange ? String(filterOptions.profitRange.min) : 'ต่ำสุด'}
							placeholderMax={filterOptions.profitRange ? String(filterOptions.profitRange.max) : 'สูงสุด'}
							onchange={() => autoApplyDebounced()}
						/>
						<RangeInput
							label="Pips"
							bind:min={pipsMin}
							bind:max={pipsMax}
							step={0.1}
							placeholderMin={filterOptions.pipsRange ? String(filterOptions.pipsRange.min) : 'ต่ำสุด'}
							placeholderMax={filterOptions.pipsRange ? String(filterOptions.pipsRange.max) : 'สูงสุด'}
							onchange={() => autoApplyDebounced()}
						/>
						<RangeInput
							label="Lot Size"
							bind:min={lotSizeMin}
							bind:max={lotSizeMax}
							step={0.01}
							placeholderMin={filterOptions.lotSizeRange ? String(filterOptions.lotSizeRange.min) : 'ต่ำสุด'}
							placeholderMax={filterOptions.lotSizeRange ? String(filterOptions.lotSizeRange.max) : 'สูงสุด'}
							onchange={() => autoApplyDebounced()}
						/>
					</div>
				{/if}
			</div>

			<!-- Section: การรีวิว -->
			<div role="group" aria-label="ตัวกรองการรีวิว">
				<button type="button" onclick={() => toggleSection('review')} class="flex items-center gap-1.5 w-full text-left mb-2" aria-expanded={sectionOpen.review}>
					<svg class="w-3.5 h-3.5 text-gray-400 transition-transform {sectionOpen.review ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7" /></svg>
					<span class="text-xs font-medium text-gray-300">การรีวิว</span>
				</button>
				{#if sectionOpen.review}
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pl-5">
						<MultiSelectDropdown
							label="สถานะรีวิว"
							options={[
								{ value: 'unreviewed', label: 'ยังไม่รีวิว' },
								{ value: 'in_progress', label: 'กำลังรีวิว' },
								{ value: 'reviewed', label: 'รีวิวแล้ว' }
							]}
							bind:selected={reviewStatus}
							onchange={() => autoApplyNow()}
						/>
						<select bind:value={followedPlan} onchange={() => autoApplyNow()} aria-label="ทำตามแผน" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
							<option value="">ทำตามแผน: ทั้งหมด</option>
							<option value="yes">ทำตามแผน</option>
							<option value="no">ไม่ทำตามแผน</option>
						</select>
						<select bind:value={hasBrokenRules} onchange={() => autoApplyNow()} aria-label="กฎที่ฝ่าฝืน" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
							<option value="">กฎที่ฝ่าฝืน: ทั้งหมด</option>
							<option value="yes">มีกฎที่ฝ่าฝืน</option>
							<option value="no">ไม่มีกฎที่ฝ่าฝืน</option>
						</select>
						<select bind:value={hasNotes} onchange={() => autoApplyNow()} aria-label="โน้ต" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
							<option value="">โน้ต: ทั้งหมด</option>
							<option value="1">มีโน้ต</option>
							<option value="0">ไม่มีโน้ต</option>
						</select>
						<select bind:value={hasAttachments} onchange={() => autoApplyNow()} aria-label="ไฟล์แนบ" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
							<option value="">ไฟล์แนบ: ทั้งหมด</option>
							<option value="1">มีไฟล์แนบ</option>
							<option value="0">ไม่มีไฟล์แนบ</option>
						</select>
					</div>
				{/if}
			</div>

			<!-- Section: คะแนน -->
			<div role="group" aria-label="ตัวกรองคะแนน">
				<button type="button" onclick={() => toggleSection('scores')} class="flex items-center gap-1.5 w-full text-left mb-2" aria-expanded={sectionOpen.scores}>
					<svg class="w-3.5 h-3.5 text-gray-400 transition-transform {sectionOpen.scores ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7" /></svg>
					<span class="text-xs font-medium text-gray-300">คะแนน</span>
				</button>
				{#if sectionOpen.scores}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-5">
						<RangeInput label="คุณภาพเซ็ตอัพ" bind:min={qualityScoreMin} bind:max={qualityScoreMax} step={1} placeholderMin="1" placeholderMax="10" onchange={() => autoApplyDebounced()} />
						<RangeInput label="วินัย" bind:min={disciplineScoreMin} bind:max={disciplineScoreMax} step={1} placeholderMin="1" placeholderMax="10" onchange={() => autoApplyDebounced()} />
						<RangeInput label="Execution" bind:min={executionScoreMin} bind:max={executionScoreMax} step={1} placeholderMin="1" placeholderMax="10" onchange={() => autoApplyDebounced()} />
						<RangeInput label="ความมั่นใจ" bind:min={confidenceMin} bind:max={confidenceMax} step={1} placeholderMin="1" placeholderMax="5" onchange={() => autoApplyDebounced()} />
					</div>
				{/if}
			</div>

			<!-- Section: แท็กและกลยุทธ์ -->
			<div role="group" aria-label="ตัวกรองแท็กและกลยุทธ์">
				<button type="button" onclick={() => toggleSection('tags')} class="flex items-center gap-1.5 w-full text-left mb-2" aria-expanded={sectionOpen.tags}>
					<svg class="w-3.5 h-3.5 text-gray-400 transition-transform {sectionOpen.tags ? 'rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7" /></svg>
					<span class="text-xs font-medium text-gray-300">แท็กและกลยุทธ์</span>
				</button>
				{#if sectionOpen.tags}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-5">
						<MultiSelectDropdown
							label="แท็ก"
							options={tagOptions}
							bind:selected={tagIds}
							searchable={true}
							groupBy={true}
							showSelectAll={true}
							onchange={() => autoApplyNow()}
						/>
						<MultiSelectDropdown
							label="กลยุทธ์"
							options={playbooks.map((p: Playbook) => ({ value: p.id, label: p.name }))}
							bind:selected={playbookIds}
							searchable={true}
							onchange={() => autoApplyNow()}
						/>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Mobile bottom sheet -->
{#if showMobileSheet}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[100] md:hidden">
		<!-- Backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="absolute inset-0 bg-black/60" onclick={() => (showMobileSheet = false)}></div>

		<!-- Sheet -->
		<div class="absolute bottom-0 left-0 right-0 bg-dark-card border-t border-dark-border rounded-t-2xl max-h-[85vh] flex flex-col" role="dialog" aria-label="ตัวกรอง">
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-dark-border shrink-0">
				<h3 class="text-sm font-medium text-white">ตัวกรอง</h3>
				<button type="button" onclick={() => (showMobileSheet = false)} class="text-gray-400 hover:text-white" aria-label="ปิด">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			</div>

			<!-- Content (scrollable) -->
			<div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
				<!-- Symbols -->
				<MultiSelectDropdown
					label="สัญลักษณ์"
					options={(filterOptions.symbols || []).map((s: string) => ({ value: s, label: s }))}
					bind:selected={symbols}
					searchable={true}
					showSelectAll={true}
				/>
				<!-- Directions -->
				<MultiSelectDropdown
					label="ทิศทาง"
					options={[{ value: 'BUY', label: 'BUY' }, { value: 'SELL', label: 'SELL' }]}
					bind:selected={directions}
				/>
				<!-- Sessions -->
				<MultiSelectDropdown
					label="เซสชัน"
					options={[
						{ value: 'asian', label: 'เอเชีย' },
						{ value: 'london', label: 'ลอนดอน' },
						{ value: 'newyork', label: 'นิวยอร์ก' }
					]}
					bind:selected={sessions}
				/>
				<!-- Outcome -->
				<select bind:value={outcome} aria-label="ผลลัพธ์" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">ผลลัพธ์ทั้งหมด</option>
					<option value="win">กำไร</option>
					<option value="loss">ขาดทุน</option>
					<option value="breakeven">เสมอตัว</option>
				</select>
				<!-- Duration -->
				<select bind:value={durationBucket} aria-label="ระยะเวลา" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">ระยะเวลาทั้งหมด</option>
					{#each filterOptions.durationBuckets || [] as bucket}
						<option value={bucket.value}>{bucket.label}</option>
					{/each}
				</select>
				<!-- Date range -->
				<div class="space-y-2">
					<span class="text-xs text-gray-400">ช่วงวันที่</span>
					<input type="date" bind:value={from} aria-label="วันที่เริ่ม" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
					<input type="date" bind:value={to} aria-label="วันที่สิ้นสุด" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
				</div>
				<!-- Day of week -->
				<div class="space-y-1">
					<span class="text-xs text-gray-400">วันในสัปดาห์</span>
					<div class="flex items-center gap-1">
						{#each DOW_OPTIONS as dow}
							<button
								type="button"
								disabled={dow.disabled}
								onclick={() => !dow.disabled && toggleDow(dow.value)}
								class="w-9 h-9 rounded text-xs font-medium transition-colors
									{dow.disabled
										? 'bg-dark-bg/30 text-gray-700 cursor-not-allowed'
										: dayOfWeek.includes(dow.value)
											? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30'
											: 'bg-dark-bg border border-dark-border text-gray-400 hover:text-white'}"
								aria-pressed={dayOfWeek.includes(dow.value)}
							>
								{dow.label}
							</button>
						{/each}
					</div>
				</div>
				<!-- P&L range -->
				<RangeInput label="P&L" unit="$" bind:min={profitMin} bind:max={profitMax} step={0.01} />
				<!-- Pips range -->
				<RangeInput label="Pips" bind:min={pipsMin} bind:max={pipsMax} step={0.1} />
				<!-- Lot size -->
				<RangeInput label="Lot Size" bind:min={lotSizeMin} bind:max={lotSizeMax} step={0.01} />
				<!-- Review status -->
				<MultiSelectDropdown
					label="สถานะรีวิว"
					options={[
						{ value: 'unreviewed', label: 'ยังไม่รีวิว' },
						{ value: 'in_progress', label: 'กำลังรีวิว' },
						{ value: 'reviewed', label: 'รีวิวแล้ว' }
					]}
					bind:selected={reviewStatus}
				/>
				<!-- Followed plan -->
				<select bind:value={followedPlan} aria-label="ทำตามแผน" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">ทำตามแผน: ทั้งหมด</option>
					<option value="yes">ทำตามแผน</option>
					<option value="no">ไม่ทำตามแผน</option>
				</select>
				<!-- Broken rules -->
				<select bind:value={hasBrokenRules} aria-label="กฎที่ฝ่าฝืน" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">กฎที่ฝ่าฝืน: ทั้งหมด</option>
					<option value="yes">มีกฎที่ฝ่าฝืน</option>
					<option value="no">ไม่มีกฎที่ฝ่าฝืน</option>
				</select>
				<!-- Notes / Attachments -->
				<div class="grid grid-cols-2 gap-2">
					<select bind:value={hasNotes} aria-label="โน้ต" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
						<option value="">โน้ต: ทั้งหมด</option>
						<option value="1">มีโน้ต</option>
						<option value="0">ไม่มีโน้ต</option>
					</select>
					<select bind:value={hasAttachments} aria-label="ไฟล์แนบ" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
						<option value="">ไฟล์แนบ: ทั้งหมด</option>
						<option value="1">มีไฟล์แนบ</option>
						<option value="0">ไม่มีไฟล์แนบ</option>
					</select>
				</div>
				<!-- Score ranges -->
				<RangeInput label="คุณภาพเซ็ตอัพ" bind:min={qualityScoreMin} bind:max={qualityScoreMax} step={1} placeholderMin="1" placeholderMax="10" />
				<RangeInput label="วินัย" bind:min={disciplineScoreMin} bind:max={disciplineScoreMax} step={1} placeholderMin="1" placeholderMax="10" />
				<RangeInput label="Execution" bind:min={executionScoreMin} bind:max={executionScoreMax} step={1} placeholderMin="1" placeholderMax="10" />
				<RangeInput label="ความมั่นใจ" bind:min={confidenceMin} bind:max={confidenceMax} step={1} placeholderMin="1" placeholderMax="5" />
				<!-- Tags -->
				<MultiSelectDropdown
					label="แท็ก"
					options={tagOptions}
					bind:selected={tagIds}
					searchable={true}
					groupBy={true}
					showSelectAll={true}
				/>
				<!-- Playbooks -->
				<MultiSelectDropdown
					label="กลยุทธ์"
					options={playbooks.map((p: Playbook) => ({ value: p.id, label: p.name }))}
					bind:selected={playbookIds}
					searchable={true}
				/>
			</div>

			<!-- Footer -->
			<div class="flex items-center gap-2 px-4 py-3 border-t border-dark-border shrink-0">
				<button type="button" onclick={() => { clearFilters(); showMobileSheet = false; }} class="flex-1 py-2 rounded border border-dark-border text-sm text-gray-400 hover:text-white">
					ล้าง
				</button>
				<button type="button" onclick={() => { applyFilters(); showMobileSheet = false; }} class="flex-1 btn-primary py-2 text-sm">
					ใช้งาน ({activeCount})
				</button>
			</div>
		</div>
	</div>
{/if}
