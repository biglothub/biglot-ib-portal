<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';

	let {
		title,
		back = false,
		actions
	}: {
		title: string;
		back?: boolean | (() => void);
		actions?: Snippet;
	} = $props();

	function goBack() {
		if (typeof back === 'function') {
			back();
			return;
		}
		if (history.length > 1) {
			history.back();
			return;
		}
		goto('/portfolio');
	}
</script>

<header class="md:hidden sticky top-0 z-[15] -mx-4 -mt-4 mb-4 border-b border-dark-border bg-dark-bg/95 px-4 pwa-safe-top backdrop-blur">
	<div class="flex min-h-14 items-center gap-2">
		{#if back}
			<button
				type="button"
				onclick={goBack}
				class="pwa-min-touch -ml-2 flex items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-dark-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
				aria-label="ย้อนกลับ"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7" />
				</svg>
			</button>
		{/if}
		<h1 class="min-w-0 flex-1 truncate text-base font-semibold text-white">{title}</h1>
		{#if actions}
			<div class="flex shrink-0 items-center gap-1">
				{@render actions()}
			</div>
		{/if}
	</div>
</header>
