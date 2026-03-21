<script lang="ts">
	import type { MarketNewsArticle, NewsCategory } from '$lib/types';
	import { timeAgo } from '$lib/utils';
	import { marketNewsStore } from '$lib/stores/newsStore';

	let { articles = [] }: { articles: MarketNewsArticle[] } = $props();

	let selectedCategory = $state<NewsCategory | 'all'>('all');
	let refreshing = $state(false);
	let showAll = $state(false);
	let localArticles = $state<MarketNewsArticle[] | null>(null);
	let effectiveArticles = $derived(localArticles ?? articles);

	const categories: { value: NewsCategory | 'all'; label: string }[] = [
		{ value: 'all', label: 'ทั้งหมด' },
		{ value: 'forex', label: 'อัตราแลกเปลี่ยน' },
		{ value: 'commodities', label: 'สินค้าโภคภัณฑ์' },
		{ value: 'central_bank', label: 'ธนาคารกลาง' },
		{ value: 'economic_data', label: 'เศรษฐกิจ' },
		{ value: 'geopolitical', label: 'ภูมิรัฐศาสตร์' }
	];

	const sourceLabels: Record<string, string> = {
		forexlive: 'ForexLive',
		dailyfx: 'DailyFX',
		investing_com: 'Investing.com',
		fxstreet: 'FXStreet'
	};

	const categoryColors: Record<string, string> = {
		forex: 'bg-blue-500/20 text-blue-300',
		commodities: 'bg-amber-500/20 text-amber-300',
		central_bank: 'bg-purple-500/20 text-purple-300',
		economic_data: 'bg-emerald-500/20 text-emerald-300',
		geopolitical: 'bg-red-500/20 text-red-300',
		general: 'bg-gray-500/20 text-gray-300'
	};

	const categoryBorderColors: Record<string, string> = {
		forex: 'border-l-blue-500/60',
		commodities: 'border-l-amber-500/60',
		central_bank: 'border-l-purple-500/60',
		economic_data: 'border-l-emerald-500/60',
		geopolitical: 'border-l-red-500/60',
		general: 'border-l-gray-500/60'
	};

	const categoryDotColors: Record<string, string> = {
		forex: 'bg-blue-400',
		commodities: 'bg-amber-400',
		central_bank: 'bg-purple-400',
		economic_data: 'bg-emerald-400',
		geopolitical: 'bg-red-400',
		general: 'bg-gray-400'
	};

	const categoryShortLabels: Record<string, string> = {
		forex: 'FX',
		commodities: 'โภคภัณฑ์',
		central_bank: 'ธ.กลาง',
		economic_data: 'เศรษฐกิจ',
		geopolitical: 'ภูมิรัฐ',
		general: 'ทั่วไป'
	};

	let filteredArticles = $derived(
		selectedCategory === 'all'
			? effectiveArticles
			: effectiveArticles.filter((a) => a.category === selectedCategory)
	);

	let displayedArticles = $derived(showAll ? filteredArticles : filteredArticles.slice(0, 5));

	let categoryCounts = $derived(
		Object.fromEntries(
			categories.map((c) => [
				c.value,
				c.value === 'all'
					? effectiveArticles.length
					: effectiveArticles.filter((a) => a.category === c.value).length
			])
		)
	);

	let lastUpdated = $derived(
		effectiveArticles.length > 0
			? effectiveArticles.reduce(
					(latest, a) => (a.fetched_at > latest ? a.fetched_at : latest),
					effectiveArticles[0].fetched_at
				)
			: null
	);

	// Auto-refresh if news is stale (>30 min) — only once per mount
	let hasAutoRefreshed = false;
	$effect(() => {
		if (hasAutoRefreshed) return;
		if (lastUpdated) {
			const staleMs = Date.now() - new Date(lastUpdated).getTime();
			if (staleMs > 30 * 60 * 1000) {
				hasAutoRefreshed = true;
				handleRefresh();
			}
		} else {
			hasAutoRefreshed = true;
			handleRefresh();
		}
	});

	async function handleRefresh() {
		if (refreshing) return;
		refreshing = true;
		try {
			const res = await fetch('/api/portfolio/news/refresh', { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				if (data.newArticles > 0) {
					// Fetch fresh news directly — no invalidateAll() cascade
					const newsRes = await fetch('/api/portfolio/news');
					if (newsRes.ok) {
						const { articles: fresh } = await newsRes.json();
						localArticles = fresh;
						marketNewsStore.set(fresh);
					}
				}
			}
		} catch {
			// Silently fail
		} finally {
			refreshing = false;
		}
	}
</script>

<div class="card">
	<div class="flex items-start justify-between gap-3">
		<div>
			<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">ข่าวตลาด</p>
			<h2 class="mt-1 text-lg font-semibold text-white">
				สรุปข่าวประจำวัน
				<span class="text-xs text-gray-500 font-normal">({effectiveArticles.length})</span>
			</h2>
		</div>
		<div class="flex items-center gap-3">
			{#if lastUpdated}
				<span class="text-[11px] text-gray-500">{timeAgo(lastUpdated)}</span>
			{/if}
			<button
				onclick={handleRefresh}
				disabled={refreshing}
				class="flex items-center gap-1.5 rounded-lg border border-dark-border px-2.5 py-1.5 text-xs text-gray-400 hover:text-white hover:border-brand-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{#if refreshing}
					<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
					</svg>
				{:else}
					<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M1 4v6h6M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round" />
						<path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				{/if}
				<span>รีเฟรช</span>
			</button>
		</div>
	</div>

	<!-- Category filter pills -->
	<div class="mt-4 flex flex-wrap gap-2">
		{#each categories as cat}
			{#if cat.value === 'all' || categoryCounts[cat.value] > 0}
				<button
					onclick={() => { selectedCategory = cat.value; showAll = false; }}
					class="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] transition-colors {selectedCategory === cat.value
						? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40 font-semibold'
						: 'bg-dark-bg/30 text-gray-400 border border-dark-border hover:text-white hover:border-gray-600 font-medium'}"
				>
					{#if cat.value !== 'all'}
						<span class="w-2 h-2 rounded-full {categoryDotColors[cat.value]}"></span>
					{/if}
					{cat.label}
					<span class="text-gray-600">({categoryCounts[cat.value]})</span>
				</button>
			{/if}
		{/each}
	</div>

	<!-- News list -->
	<div class="mt-4 space-y-2">
		{#if refreshing && filteredArticles.length === 0}
			<div class="space-y-2 animate-pulse">
				{#each Array(4) as _}
					<div class="rounded-xl border-l-2 border-dark-border px-4 py-3 bg-dark-bg/30">
						<div class="flex items-start gap-3">
							<div class="flex-1 space-y-2 min-w-0">
								<div class="h-3 w-4/5 bg-dark-border/50 rounded"></div>
								<div class="h-3 w-2/3 bg-dark-border/30 rounded"></div>
								<div class="h-2.5 w-1/3 bg-dark-border/20 rounded"></div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else if filteredArticles.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-gray-500">
				<svg class="w-8 h-8 mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
				</svg>
				<p class="text-sm">ยังไม่มีข่าวในหมวดนี้</p>
			</div>
		{:else}
			{#each displayedArticles as article}
				<a
					href={article.source_url}
					target="_blank"
					rel="noopener noreferrer"
					class="block rounded-xl border-l-2 px-4 py-3 transition-colors
						{categoryBorderColors[article.category] || categoryBorderColors.general}
						{article.relevance_score > 75
							? 'bg-gradient-to-r from-brand-primary/5 to-dark-bg/30 hover:from-brand-primary/10 hover:to-dark-bg/50'
							: 'bg-dark-bg/30 hover:bg-dark-bg/50'}"
				>
					<div class="flex items-start gap-3">
						<div class="min-w-0 flex-1">
							<h3 class="text-sm font-medium text-white leading-snug line-clamp-2">
								{article.title_th || article.title_original}
							</h3>
							{#if article.summary_th}
								<p class="mt-1 text-[12px] text-gray-400 leading-relaxed line-clamp-2">
									{article.summary_th}
								</p>
							{/if}
							<div class="mt-2 flex items-center justify-between">
								<div class="flex items-center gap-1.5 text-[10px] text-gray-500">
									<span>{sourceLabels[article.source] || article.source}</span>
									<span class="text-gray-700">&middot;</span>
									<span>{timeAgo(article.published_at)}</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="rounded-full px-2 py-0.5 text-[10px] font-medium {categoryColors[article.category] || categoryColors.general}">
										{categoryShortLabels[article.category] || article.category}
									</span>
									{#each article.symbols.slice(0, 3) as symbol}
										<span class="rounded bg-dark-bg/60 px-1.5 py-0.5 text-[10px] font-mono text-gray-400">
											{symbol}
										</span>
									{/each}
								</div>
							</div>
						</div>
						{#if article.image_url}
							<img
								src={article.image_url}
								alt=""
								class="w-20 h-14 rounded-lg object-cover flex-shrink-0 bg-dark-bg"
								loading="lazy"
								onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
							/>
						{/if}
					</div>
				</a>
			{/each}

			{#if filteredArticles.length > 5 && !showAll}
				<button
					onclick={() => showAll = true}
					class="w-full rounded-xl border border-dark-border bg-dark-bg/20 px-3 py-3 text-center text-sm text-gray-400 hover:text-white hover:border-brand-primary/30 hover:bg-dark-hover transition-all flex items-center justify-center gap-2"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
					ดูเพิ่มเติม ({filteredArticles.length - 5} ข่าว)
				</button>
			{/if}
		{/if}
	</div>
</div>
