<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		onrefresh,
		disabled = false,
		children
	}: {
		onrefresh: () => Promise<void> | void;
		disabled?: boolean;
		children: Snippet;
	} = $props();

	const THRESHOLD = 80;
	const MAX_VISUAL = 96;
	let startY = $state(0);
	let delta = $state(0);
	let pulling = $state(false);
	let refreshing = $state(false);

	const progress = $derived(Math.min(delta / THRESHOLD, 1));
	const visible = $derived(delta > 0 || refreshing);

	function touchStart(event: TouchEvent) {
		if (disabled || refreshing || window.scrollY > 0) return;
		startY = event.touches[0].clientY;
		pulling = true;
	}

	function touchMove(event: TouchEvent) {
		if (!pulling || disabled || refreshing) return;
		const next = event.touches[0].clientY - startY;
		if (next > 0 && window.scrollY === 0) {
			delta = Math.min(next, MAX_VISUAL);
			event.preventDefault();
		}
	}

	async function touchEnd() {
		if (!pulling) return;
		pulling = false;
		if (delta >= THRESHOLD) {
			refreshing = true;
			delta = 0;
			await onrefresh();
			refreshing = false;
			return;
		}
		delta = 0;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="contents md:contents" ontouchstart={touchStart} ontouchmove={touchMove} ontouchend={touchEnd}>
	{#if visible}
		<div
			class="md:hidden fixed left-1/2 top-0 z-[35] flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-dark-border bg-dark-surface shadow-lg transition-transform duration-150"
			style="transform: translateX(-50%) translateY({refreshing ? 12 : Math.max(delta - 44, -36)}px)"
			aria-hidden="true"
		>
			<svg
				class="h-5 w-5 {refreshing ? 'animate-spin text-brand-primary' : 'text-gray-400'}"
				style={!refreshing ? `opacity: ${progress}; transform: rotate(${progress * 180}deg)` : ''}
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9M4.582 9H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
			</svg>
		</div>
	{/if}

	{@render children()}
</div>
