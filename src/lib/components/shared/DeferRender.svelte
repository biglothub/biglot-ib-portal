<script lang="ts">
	import { browser } from '$app/environment';

	/** Delay in ms before this deferred block renders (default 0 = next frame) */
	let { delay = 0, children }: { delay?: number; children: any } = $props();
	let visible = $state(!browser);

	$effect(() => {
		if (!browser) return;
		if (delay > 0) {
			const timer = setTimeout(() => { visible = true; }, delay);
			return () => clearTimeout(timer);
		} else {
			// Use double rAF to let the browser paint the critical content first
			let raf2: number;
			const raf1 = requestAnimationFrame(() => {
				raf2 = requestAnimationFrame(() => { visible = true; });
			});
			return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
		}
	});
</script>

{#if visible}
	{@render children()}
{:else}
	<div class="animate-pulse rounded-xl bg-dark-surface/50 h-32"></div>
{/if}
