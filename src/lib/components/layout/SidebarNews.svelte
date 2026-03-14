<script lang="ts">
	import { marketNewsStore } from '$lib/stores/newsStore';
	import { timeAgo } from '$lib/utils';
	import { slide } from 'svelte/transition';

	let { collapsed = false }: { collapsed?: boolean } = $props();

	let articles = $state<any[]>([]);
	let refreshing = $state(false);
	let expanded = $state(true);

	const categoryDotColors: Record<string, string> = {
		forex: 'bg-blue-400',
		commodities: 'bg-amber-400',
		central_bank: 'bg-purple-400',
		economic_data: 'bg-emerald-400',
		geopolitical: 'bg-red-400',
		general: 'bg-gray-400'
	};

	const categoryThaiLabels: Record<string, string> = {
		forex: 'อัตราแลกเปลี่ยน',
		commodities: 'สินค้าโภคภัณฑ์',
		central_bank: 'ธนาคารกลาง',
		economic_data: 'ข้อมูลเศรษฐกิจ',
		geopolitical: 'ภูมิรัฐศาสตร์',
		general: 'ทั่วไป'
	};

	marketNewsStore.subscribe((v) => (articles = v));

	let displayedArticles = $derived(articles.slice(0, 8));

	let isStale = $derived(() => {
		if (articles.length === 0) return true;
		const latest = articles.reduce(
			(max, a) => (a.published_at > max ? a.published_at : max),
			articles[0].published_at
		);
		return Date.now() - new Date(latest).getTime() > 30 * 60 * 1000;
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

{#if !collapsed && articles.length > 0}
	<div class="border-t border-dark-border h-full flex flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-2.5 text-xs text-gray-400">
			<button
				class="flex items-center gap-1.5 uppercase tracking-widest font-medium hover:text-white transition-colors"
				onclick={() => (expanded = !expanded)}
			>
				<span
					class="w-1.5 h-1.5 rounded-full {isStale() ? 'bg-amber-500' : 'bg-emerald-500'}"
				></span>
				ข่าวตลาด
			</button>
			<div class="flex items-center gap-1.5">
				<button
					onclick={handleRefresh}
					disabled={refreshing}
					class="p-0.5 rounded hover:text-white hover:bg-dark-hover disabled:opacity-50 transition-colors active:scale-95"
					title="รีเฟรชข่าว"
				>
					{#if refreshing}
						<svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							></path>
						</svg>
					{:else}
						<svg
							class="h-3 w-3"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M1 4v6h6M23 20v-6h-6"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
							<path
								d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
				</button>
				<button
					onclick={() => (expanded = !expanded)}
					class="p-0.5 rounded hover:text-white transition-colors"
					aria-label={expanded ? 'ย่อรายการข่าว' : 'ขยายรายการข่าว'}
					title={expanded ? 'ย่อรายการข่าว' : 'ขยายรายการข่าว'}
				>
					<svg
						class="w-3 h-3 transition-transform {expanded ? '' : '-rotate-90'}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>
			</div>
		</div>

		{#if expanded}
			<div
				class="px-2 pb-3 space-y-1 overflow-y-auto flex-1 min-h-0"
				transition:slide={{ duration: 200 }}
			>
				{#each displayedArticles as article}
					<a
						href={article.source_url}
						target="_blank"
						rel="noopener noreferrer"
						class="block px-2 py-2 rounded-lg hover:bg-dark-hover hover:translate-x-0.5 transition-all group
							{article.relevance_score > 85
							? 'border-l-2 border-brand-primary pl-1.5 bg-brand-primary/5'
							: article.relevance_score > 60
								? 'border-l-2 border-brand-primary/40 pl-1.5'
								: ''}"
						title={article.summary_th || article.title_original}
					>
						<p
							class="text-[12px] leading-tight group-hover:text-white line-clamp-2
								{article.relevance_score > 85
								? 'text-gray-200 font-medium'
								: 'text-gray-200'}"
						>
							{article.title_th || article.title_original}
						</p>
						<div class="mt-1 flex items-center gap-1.5 text-[10px]">
							<span
								class="w-1.5 h-1.5 rounded-full flex-shrink-0 {categoryDotColors[article.category] || 'bg-gray-400'}"
								title={categoryThaiLabels[article.category] || 'ทั่วไป'}
							></span>
							<span class="text-gray-500">{timeAgo(article.published_at)}</span>
							{#if article.symbols.length > 0}
								<span class="text-gray-600">&middot;</span>
								<span class="text-gray-500 font-mono">{article.symbols[0]}</span>
							{/if}
							{#if article.relevance_score > 85}
								<span class="text-brand-primary font-medium">สำคัญ</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}
