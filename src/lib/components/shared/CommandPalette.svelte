<script lang="ts">
	import { goto } from '$app/navigation';
	import { focusTrap } from '$lib/actions/focusTrap';

	let { accountId }: { accountId: string } = $props();

	interface SearchResult {
		id: string;
		title: string;
		subtitle: string;
		href: string;
		type: 'trade' | 'journal' | 'note' | 'playbook';
	}

	interface SearchResponse {
		trades: SearchResult[];
		journals: SearchResult[];
		notes: SearchResult[];
		playbooks: SearchResult[];
	}

	const RECENT_KEY = 'ib-search-recent';
	const MAX_RECENT = 5;

	let open = $state(false);
	let query = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let results = $state<SearchResponse | null>(null);
	let highlightedIndex = $state(-1);
	let inputEl = $state<HTMLInputElement | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const OVERLAY_ID = 'command-palette';

	// Expose open method for parent use
	export function openPalette() {
		open = true;
		recentSearches = loadRecent();
		highlightedIndex = -1;
	}

	export function togglePalette() {
		if (open) {
			closePalette();
			return;
		}
		openPalette();
	}

	// Flatten all results for keyboard navigation
	const flatResults = $derived<SearchResult[]>(
		results
			? [
					...results.trades,
					...results.journals,
					...results.notes,
					...results.playbooks,
				]
			: []
	);

	const hasResults = $derived(
		results !== null && (
			results.trades.length > 0 ||
			results.journals.length > 0 ||
			results.notes.length > 0 ||
			results.playbooks.length > 0
		)
	);

	const isEmpty = $derived(query.length >= 2 && !loading && results !== null && !hasResults);

	// Recent searches
	let recentSearches = $state<string[]>([]);

	function loadRecent(): string[] {
		try {
			const stored = localStorage.getItem(RECENT_KEY);
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	}

	function saveRecent(term: string) {
		const recent = loadRecent().filter(r => r !== term);
		recent.unshift(term);
		const trimmed = recent.slice(0, MAX_RECENT);
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
			recentSearches = trimmed;
		} catch {
			// ignore storage errors
		}
	}

	function clearRecent() {
		try {
			localStorage.removeItem(RECENT_KEY);
			recentSearches = [];
		} catch {
			// ignore
		}
	}

	function closePalette() {
		open = false;
		query = '';
		results = null;
		error = null;
		loading = false;
		highlightedIndex = -1;
		if (debounceTimer) clearTimeout(debounceTimer);
	}

	async function doSearch(q: string) {
		if (q.length < 2) {
			results = null;
			loading = false;
			return;
		}

		loading = true;
		error = null;

		try {
			const res = await fetch('/api/portfolio/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: q, accountId }),
			});

			if (res.status === 429) {
				error = 'คำขอมากเกินไป กรุณารอสักครู่';
				results = null;
				return;
			}

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				error = (body as { message?: string }).message || 'เกิดข้อผิดพลาดในการค้นหา';
				results = null;
				return;
			}

			results = await res.json();
			highlightedIndex = -1;
		} catch {
			error = 'ไม่สามารถเชื่อมต่อได้';
			results = null;
		} finally {
			loading = false;
		}
	}

	function handleInput() {
		if (debounceTimer) clearTimeout(debounceTimer);
		highlightedIndex = -1;
		if (query.length < 2) {
			results = null;
			loading = false;
			return;
		}
		loading = true;
		debounceTimer = setTimeout(() => doSearch(query), 300);
	}

	function navigateTo(result: SearchResult) {
		saveRecent(result.title);
		closePalette();
		goto(result.href);
	}

	function handleModalKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, flatResults.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, -1);
		} else if (e.key === 'Enter' && highlightedIndex >= 0 && flatResults[highlightedIndex]) {
			e.preventDefault();
			navigateTo(flatResults[highlightedIndex]);
		}
	}

	const typeIconPaths: Record<string, string> = {
		trade: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
		journal: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
		note: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
		playbook: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
	};

	const sectionConfig: Array<{ key: keyof SearchResponse; label: string }> = [
		{ key: 'trades', label: 'เทรด' },
		{ key: 'journals', label: 'บันทึกประจำวัน' },
		{ key: 'notes', label: 'โน้ต' },
		{ key: 'playbooks', label: 'Playbook' },
	];

	function getGlobalIndex(sectionKey: keyof SearchResponse, localIndex: number): number {
		const order: Array<keyof SearchResponse> = ['trades', 'journals', 'notes', 'playbooks'];
		let base = 0;
		for (const sk of order) {
			if (sk === sectionKey) break;
			base += results?.[sk]?.length ?? 0;
		}
		return base + localIndex;
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			onclick={closePalette}
			tabindex="-1"
			aria-hidden="true"
		></button>

		<!-- Modal -->
		<div
			use:focusTrap={{ id: OVERLAY_ID, enabled: open, initialFocus: 'input[type="search"]', lockScroll: true }}
			role="dialog"
			aria-modal="true"
			aria-label="ค้นหาทั่วไป"
			tabindex="-1"
			class="relative w-full max-w-2xl bg-dark-surface border border-dark-border rounded-xl shadow-2xl overflow-hidden focus:outline-none"
			onkeydown={handleModalKeydown}
			onescape={closePalette}
		>
			<!-- Search input row -->
			<div class="flex items-center gap-3 px-4 py-3 border-b border-dark-border">
				{#if loading}
					<svg class="w-5 h-5 text-brand-primary shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
					</svg>
				{:else}
					<svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
					</svg>
				{/if}
				<input
					bind:this={inputEl}
					bind:value={query}
					oninput={handleInput}
					type="search"
					placeholder="ค้นหาด้วย..."
					class="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
					aria-label="ค้นหาเทรด บันทึก โน้ต หรือ Playbook"
					autocomplete="off"
					autocorrect="off"
					spellcheck="false"
				/>
				<div class="flex items-center gap-1 shrink-0">
					<kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-gray-400 bg-dark-bg border border-dark-border font-mono">
						Esc
					</kbd>
					<button
						onclick={closePalette}
						class="p-1 rounded text-gray-400 hover:text-gray-400 transition-colors"
						aria-label="ปิดการค้นหา"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Results / recent / states -->
			<div
				role="listbox"
				aria-label="ผลการค้นหา"
				aria-live="polite"
				class="max-h-[60vh] overflow-y-auto"
			>
				{#if error}
					<div class="px-4 py-6 text-center text-sm text-red-400" role="alert">
						{error}
					</div>

				{:else if isEmpty}
					<div class="px-4 py-8 text-center text-sm text-gray-400">
						ไม่พบผลลัพธ์
					</div>

				{:else if hasResults && results}
					{#each sectionConfig as section}
						{@const items = results[section.key]}
						{#if items.length > 0}
							<div>
								<div class="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-dark-bg/50">
									{section.label}
								</div>
								{#each items as result, localIdx}
									{@const globalIdx = getGlobalIndex(section.key, localIdx)}
									<button
										role="option"
										aria-selected={highlightedIndex === globalIdx}
										onclick={() => navigateTo(result)}
										class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
											{highlightedIndex === globalIdx
												? 'bg-brand-primary/10 text-white'
												: 'text-gray-300 hover:bg-dark-bg/60 hover:text-white'}"
										aria-label="{result.title} — {result.subtitle}"
									>
										<div class="shrink-0 w-8 h-8 rounded-lg bg-dark-bg flex items-center justify-center">
											<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={typeIconPaths[result.type]} />
											</svg>
										</div>
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium truncate">{result.title}</p>
											{#if result.subtitle}
												<p class="text-xs text-gray-400 truncate mt-0.5">{result.subtitle}</p>
											{/if}
										</div>
									</button>
								{/each}
							</div>
						{/if}
					{/each}

				{:else if query.length === 0 && recentSearches.length > 0}
					<div>
						<div class="px-4 py-2 flex items-center justify-between">
							<span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">ค้นหาล่าสุด</span>
							<button
								onclick={clearRecent}
								class="text-xs text-gray-400 hover:text-gray-400 transition-colors"
								aria-label="ล้างประวัติการค้นหา"
							>
								ล้าง
							</button>
						</div>
						{#each recentSearches as term}
							<button
								onclick={() => { query = term; handleInput(); }}
								class="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-400 hover:bg-dark-bg/60 hover:text-white transition-colors"
								aria-label="ค้นหา: {term}"
							>
								<svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0" />
								</svg>
								<span class="text-sm">{term}</span>
							</button>
						{/each}
					</div>

				{:else if query.length === 0}
					<div class="px-4 py-8 text-center text-sm text-gray-400">
						พิมพ์เพื่อค้นหาเทรด บันทึก โน้ต หรือ Playbook
					</div>

				{:else if query.length === 1}
					<div class="px-4 py-6 text-center text-sm text-gray-400">
						พิมพ์อีก 1 ตัวอักษร...
					</div>
				{/if}
			</div>

			<!-- Footer hint -->
			<div class="px-4 py-2 border-t border-dark-border flex items-center gap-4 text-xs text-gray-400">
				<span class="flex items-center gap-1">
					<kbd class="px-1 rounded border border-dark-border bg-dark-bg font-mono">↑</kbd>
					<kbd class="px-1 rounded border border-dark-border bg-dark-bg font-mono">↓</kbd>
					เลือก
				</span>
				<span class="flex items-center gap-1">
					<kbd class="px-1 rounded border border-dark-border bg-dark-bg font-mono">Enter</kbd>
					เปิด
				</span>
				<span class="flex items-center gap-1">
					<kbd class="px-1 rounded border border-dark-border bg-dark-bg font-mono">Esc</kbd>
					ปิด
				</span>
			</div>
		</div>
	</div>
{/if}
