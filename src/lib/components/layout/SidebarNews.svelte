<script lang="ts">
	import { marketNewsStore } from '$lib/stores/newsStore';
	import { timeAgo } from '$lib/utils';
	import { invalidateAll } from '$app/navigation';
	let { collapsed = false }: { collapsed?: boolean } = $props();

	let articles = $state<any[]>([]);
	let refreshing = $state(false);
	let expanded = $state(true);

	const categoryColors: Record<string, string> = {
		forex: 'text-blue-400',
		commodities: 'text-amber-400',
		central_bank: 'text-purple-400',
		economic_data: 'text-emerald-400',
		geopolitical: 'text-red-400',
		general: 'text-gray-400'
	};

	const categoryLabels: Record<string, string> = {
		forex: 'FX',
		commodities: 'CMD',
		central_bank: 'CB',
		economic_data: 'ECO',
		geopolitical: 'GEO',
		general: 'GEN'
	};

	marketNewsStore.subscribe((v) => articles = v);

	let displayedArticles = $derived(articles.slice(0, 8));

	async function handleRefresh() {
		if (refreshing) return;
		refreshing = true;
		try {
			const res = await fetch('/api/portfolio/news/refresh', { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				if (data.newArticles > 0) {
					await invalidateAll();
				}
			}
		} catch {
			// Silently fail
		} finally {
			refreshing = false;
		}
	}
</script>

{#if !collapsed && articles.length > 0}
	<div class="border-t border-dark-border h-full flex flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-2.5 text-xs text-gray-400">
			<button
				class="uppercase tracking-widest font-medium hover:text-white transition-colors"
				onclick={() => expanded = !expanded}
			>
				ข่าวตลาด
			</button>
			<div class="flex items-center gap-1.5">
				<button
					onclick={handleRefresh}
					disabled={refreshing}
					class="p-0.5 rounded hover:text-white hover:bg-dark-hover disabled:opacity-50 transition-colors"
					title="รีเฟรชข่าว"
				>
					{#if refreshing}
						<svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
					{:else}
						<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M1 4v6h6M23 20v-6h-6" stroke-linecap="round" stroke-linejoin="round" />
							<path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					{/if}
				</button>
				<button
					onclick={() => expanded = !expanded}
					class="p-0.5 rounded hover:text-white transition-colors"
				>
					<svg class="w-3 h-3 transition-transform {expanded ? '' : '-rotate-90'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			</div>
		</div>

		{#if expanded}
			<div class="px-2 pb-3 space-y-0.5 overflow-y-auto flex-1 min-h-0">
				{#each displayedArticles as article}
					<a
						href={article.source_url}
						target="_blank"
						rel="noopener noreferrer"
						class="block px-2 py-2 rounded-lg hover:bg-dark-hover transition-colors group
							{article.relevance_score > 75 ? 'border-l-2 border-brand-primary pl-1.5' : ''}"
						title={article.title_original}
					>
						<p class="text-[12px] leading-tight text-gray-300 group-hover:text-white line-clamp-2">
							{article.title_th || article.title_original}
						</p>
						<div class="mt-1 flex items-center gap-1.5 text-[10px]">
							<span class="{categoryColors[article.category] || 'text-gray-500'} font-medium">
								{categoryLabels[article.category] || 'GEN'}
							</span>
							<span class="text-gray-600">·</span>
							<span class="text-gray-500">{timeAgo(article.published_at)}</span>
							{#if article.symbols.length > 0}
								<span class="text-gray-600">·</span>
								<span class="text-gray-500 font-mono">{article.symbols[0]}</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}
