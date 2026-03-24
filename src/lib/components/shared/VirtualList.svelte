<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props<T> {
		items: T[];
		itemHeight: number;
		overscan?: number;
		item: Snippet<[T, number]>;
		onscrollend?: () => void;
	}

	let {
		items,
		itemHeight,
		overscan = 5,
		item: itemSnippet,
		onscrollend
	}: Props<T> = $props();

	let containerEl = $state<HTMLDivElement | undefined>(undefined);
	let scrollTop = $state(0);
	let containerHeight = $state(0);

	const totalHeight = $derived(items.length * itemHeight);

	const visibleRange = $derived.by(() => {
		const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
		const end = Math.min(
			items.length - 1,
			Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
		);
		return { start, end };
	});

	const visibleItems = $derived(
		items.slice(visibleRange.start, visibleRange.end + 1).map((it, i) => ({
			item: it,
			index: visibleRange.start + i,
			top: (visibleRange.start + i) * itemHeight
		}))
	);

	function handleScroll(e: Event) {
		const el = e.currentTarget as HTMLDivElement;
		scrollTop = el.scrollTop;

		// Fire scrollend when within 200px of bottom
		if (onscrollend && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
			onscrollend();
		}
	}

	$effect(() => {
		if (!containerEl) return;
		const ro = new ResizeObserver((entries) => {
			containerHeight = entries[0].contentRect.height;
		});
		ro.observe(containerEl);
		containerHeight = containerEl.clientHeight;
		return () => ro.disconnect();
	});
</script>

<div
	bind:this={containerEl}
	class="relative overflow-y-auto h-full w-full"
	onscroll={handleScroll}
	role="list"
>
	<!-- Spacer that defines the full scrollable height -->
	<div style:height="{totalHeight}px" class="relative">
		{#each visibleItems as row (row.index)}
			<div
				class="absolute w-full"
				style:top="{row.top}px"
				style:height="{itemHeight}px"
				role="listitem"
			>
				{@render itemSnippet(row.item, row.index)}
			</div>
		{/each}
	</div>
</div>
