<script lang="ts">
import { goto, invalidateAll } from '$app/navigation';
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

		await invalidateAll();
	}

	async function deleteView(id: string) {
		await fetch('/api/portfolio/saved-views', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		await invalidateAll();
	}
</script>

<div class="card">
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="w-full flex items-center justify-between gap-3"
	>
		<div class="flex items-center gap-2">
			<h3 class="text-sm font-medium text-white">Filters</h3>
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
	<div class="mt-4 space-y-4">
	<div class="flex items-center justify-end gap-2">
		{#if pageKey === 'trades' || pageKey === 'analytics'}
			<button type="button" onclick={saveView} class="text-xs text-brand-primary hover:text-brand-primary/80">
				Save View
			</button>
		{/if}
		<button type="button" onclick={clearFilters} class="text-xs text-gray-400 hover:text-white">
			Clear
		</button>
		<button type="button" onclick={() => applyFilters()} class="btn-primary text-sm px-3 py-2">
			Apply
		</button>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
		<input
			type="text"
			bind:value={q}
			placeholder="Search symbol, notes, lesson..."
			class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
		/>
		<input type="date" bind:value={from} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
		<input type="date" bind:value={to} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
		<select bind:value={outcome} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
			<option value="">All outcomes</option>
			<option value="win">Win</option>
			<option value="loss">Loss</option>
			<option value="breakeven">Breakeven</option>
		</select>

		<MultiSelectDropdown
			label="Symbols"
			options={(filterOptions.symbols || []).map((s: string) => ({ value: s, label: s }))}
			bind:selected={symbols}
		/>
		<MultiSelectDropdown
			label="Sessions"
			options={[
				{ value: 'asian', label: 'Asian' },
				{ value: 'london', label: 'London' },
				{ value: 'newyork', label: 'New York' }
			]}
			bind:selected={sessions}
		/>
		<MultiSelectDropdown
			label="Directions"
			options={[
				{ value: 'BUY', label: 'BUY' },
				{ value: 'SELL', label: 'SELL' }
			]}
			bind:selected={directions}
		/>
		<MultiSelectDropdown
			label="Review Status"
			options={[
				{ value: 'unreviewed', label: 'Unreviewed' },
				{ value: 'in_progress', label: 'In Progress' },
				{ value: 'reviewed', label: 'Reviewed' }
			]}
			bind:selected={reviewStatus}
		/>

		<MultiSelectDropdown
			label="Tags"
			options={tags.map((t: any) => ({ value: t.id, label: t.name }))}
			bind:selected={tagIds}
		/>
		<MultiSelectDropdown
			label="Playbooks"
			options={playbooks.map((p: any) => ({ value: p.id, label: p.name }))}
			bind:selected={playbookIds}
		/>
		<select bind:value={durationBucket} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
			<option value="">All durations</option>
			{#each filterOptions.durationBuckets || [] as bucket}
				<option value={bucket.value}>{bucket.label}</option>
			{/each}
		</select>
		<div class="grid grid-cols-2 gap-3">
			<select bind:value={hasNotes} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
				<option value="">Notes: all</option>
				<option value="1">Has notes</option>
				<option value="0">No notes</option>
			</select>
			<select bind:value={hasAttachments} class="bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
				<option value="">Attach: all</option>
				<option value="1">Has attachments</option>
				<option value="0">No attachments</option>
			</select>
		</div>
	</div>

	{#if savedViews.length > 0}
		<div class="space-y-2">
			<div class="text-xs text-gray-500">Saved Views</div>
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
