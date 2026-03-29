<script lang="ts">
	import { browser } from '$app/environment';

	/** Delay in ms before this deferred block renders (default 0 = next frame) */
	let { delay = 0, children }: { delay?: number; children: any } = $props();
	let visible = $state(!browser);

	if (browser) {
		if (delay > 0) {
			setTimeout(() => { visible = true; }, delay);
		} else {
			// Use double rAF to let the browser paint the critical content first
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					visible = true;
				});
			});
		}
	}
</script>

{#if visible}
	{@render children()}
{:else}
	<div class="animate-pulse rounded-xl bg-dark-surface/50 h-32"></div>
{/if}
