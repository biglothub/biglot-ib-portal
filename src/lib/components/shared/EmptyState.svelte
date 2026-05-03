<script lang="ts">
	import type { Snippet } from 'svelte';

	let { message = 'ไม่มีข้อมูล', icon = '', children }: {
		message?: string;
		icon?: string;
		children?: Snippet;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center text-gray-400">
	{#if icon}
		<span class="mb-3 text-3xl text-brand-primary">{icon}</span>
	{:else}
		<svg class="mb-3 h-10 w-10 text-brand-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
		</svg>
	{/if}
	<p class="text-sm">{message}</p>
	{#if children}
		<div class="mt-3">
			{@render children()}
		</div>
	{/if}
</div>
