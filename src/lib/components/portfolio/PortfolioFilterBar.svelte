<script lang="ts">
import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { buildPortfolioSearchParams, EMPTY_PORTFOLIO_FILTERS } from '$lib/portfolio';
	import type { PortfolioFilterState } from '$lib/types';
	import MultiSelectDropdown from '$lib/components/shared/MultiSelectDropdown.svelte';

	let {
		filters = EMPTY_PORTFOLIO_FILTERS,
		filterOptions,
		tags = [],
		playbooks = [],
		savedViews = [],
		pageKey = 'trades'
	}: {
		filters?: PortfolioFilterState;
		filterOptions: any;
		tags?: any[];
		playbooks?: any[];
		savedViews?: any[];
		pageKey?: string;
	} = $props();

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
	let expanded = $state(false);

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
		(durationBucket ? 1 : 0)
	);

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
	});

	function applyFilters(next?: Partial<PortfolioFilterState>) {
		const params = buildPortfolioSearchParams({
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
			...next
		});

		goto(`${$page.url.pathname}${params.toString() ? `?${params.toString()}` : ''}`);
	}

	function clearFilters() {
		goto($page.url.pathname);
	}

	async function saveView() {
		if (!(pageKey === 'trades' || pageKey === 'analytics')) return;
		const name = window.prompt('ตั้งชื่อ saved view');
		if (!name) return;

		await fetch('/api/portfolio/saved-views', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				page: pageKey,
				name,
				filters: {
					q,
					from,
					to,
					symbols,
					sessions,
					directions,
					tagIds,
					playbookIds,
					reviewStatus,
					outcome,
					hasNotes: hasNotes === '' ? null : hasNotes === '1',
					hasAttachments: hasAttachments === '' ? null : hasAttachments === '1',
					durationBucket
				}
			})
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
</script>

<div class="card">
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
		aria-controls="filter-panel"
		class="w-full flex items-center justify-between gap-3"
	>
		<div class="flex items-center gap-2">
			<h3 class="text-sm font-medium text-white">ตัวกรอง</h3>
			{#if activeCount > 0 && !expanded}
				<span class="inline-flex items-center justify-center rounded-full bg-brand-primary/20 text-brand-primary text-[10px] font-semibold px-1.5 py-0.5 min-w-[18px]">
					{activeCount}
				</span>
			{/if}
		</div>
		<svg class="w-4 h-4 text-gray-500 transition-transform {expanded ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if expanded}
	<div id="filter-panel" class="mt-4 space-y-4">
	<div class="flex items-center justify-end gap-2">
		{#if pageKey === 'trades' || pageKey === 'analytics'}
			<button type="button" onclick={saveView} class="text-xs text-brand-primary hover:text-brand-primary/80">
				บันทึกมุมมอง
			</button>
		{/if}
		<button type="button" onclick={clearFilters} class="text-xs text-gray-400 hover:text-white">
			ล้าง
		</button>
		<button type="button" onclick={() => applyFilters()} class="btn-primary text-sm px-3 py-2">
			ใช้งาน
		</button>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
		<input
			type="text"
			bind:value={q}
			placeholder="ค้นหา symbol, notes, lesson..."
			aria-label="ค้นหา"
			class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
		/>
		<input type="date" bind:value={from} aria-label="วันที่เริ่ม" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
		<input type="date" bind:value={to} aria-label="วันที่สิ้นสุด" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
		<select bind:value={outcome} aria-label="ผลลัพธ์" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
			<option value="">ผลลัพธ์ทั้งหมด</option>
			<option value="win">กำไร</option>
			<option value="loss">ขาดทุน</option>
			<option value="breakeven">เสมอตัว</option>
		</select>

		<MultiSelectDropdown
			label="สัญลักษณ์"
			options={(filterOptions.symbols || []).map((s: string) => ({ value: s, label: s }))}
			bind:selected={symbols}
		/>
		<MultiSelectDropdown
			label="เซสชัน"
			options={[
				{ value: 'asian', label: 'เอเชีย' },
				{ value: 'london', label: 'ลอนดอน' },
				{ value: 'newyork', label: 'นิวยอร์ก' }
			]}
			bind:selected={sessions}
		/>
		<MultiSelectDropdown
			label="ทิศทาง"
			options={[
				{ value: 'BUY', label: 'BUY' },
				{ value: 'SELL', label: 'SELL' }
			]}
			bind:selected={directions}
		/>
		<MultiSelectDropdown
			label="สถานะรีวิว"
			options={[
				{ value: 'unreviewed', label: 'ยังไม่รีวิว' },
				{ value: 'in_progress', label: 'กำลังรีวิว' },
				{ value: 'reviewed', label: 'รีวิวแล้ว' }
			]}
			bind:selected={reviewStatus}
		/>

		<MultiSelectDropdown
			label="แท็ก"
			options={tags.map((t: any) => ({ value: t.id, label: t.name }))}
			bind:selected={tagIds}
		/>
		<MultiSelectDropdown
			label="กลยุทธ์"
			options={playbooks.map((p: any) => ({ value: p.id, label: p.name }))}
			bind:selected={playbookIds}
		/>
		<select bind:value={durationBucket} aria-label="ระยะเวลา" class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
			<option value="">ระยะเวลาทั้งหมด</option>
			{#each filterOptions.durationBuckets || [] as bucket}
				<option value={bucket.value}>{bucket.label}</option>
			{/each}
		</select>
		<div class="grid grid-cols-2 gap-3">
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
	</div>

	{#if savedViews.length > 0}
		<div class="space-y-2">
			<div class="text-xs text-gray-500">มุมมองที่บันทึก</div>
			<div class="flex flex-wrap gap-2">
				{#each savedViews as view}
					<div class="inline-flex items-center gap-2 rounded-full border border-dark-border bg-dark-bg/40 px-3 py-1.5 text-xs text-gray-300">
						<button type="button" onclick={() => applyFilters(view.filters)} class="hover:text-white">
							{view.name}
						</button>
						<button type="button" onclick={() => deleteView(view.id)} class="text-red-300 hover:text-red-200">
							×
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}
	</div>
	{/if}
</div>
