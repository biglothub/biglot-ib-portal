<script lang="ts">
	import { getPendingDeletes, cancelDelete } from '$lib/stores/undoQueue.svelte'

	const pendingDeletes = $derived(getPendingDeletes())
</script>

{#if pendingDeletes.length > 0}
	<div
		class="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 md:px-0"
		aria-live="polite"
		aria-label="คิวการลบที่รอดำเนินการ"
	>
		{#each pendingDeletes as item (item.id)}
			<div
				role="alert"
				class="relative overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-xl flex items-center gap-3 px-4 py-3"
			>
				<!-- Content -->
				<div class="flex-1 min-w-0">
					<p class="text-sm text-white truncate">ลบแล้ว: <span class="text-gray-400">{item.label}</span></p>
				</div>
				<!-- Undo button -->
				<button
					type="button"
					onclick={() => cancelDelete(item.id)}
					class="shrink-0 text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors px-2 py-1 rounded-md hover:bg-brand-primary/10"
				>
					ยกเลิก
				</button>
				<!-- Countdown bar -->
				<div class="absolute bottom-0 left-0 h-0.5 w-full bg-dark-border">
					<div class="h-full bg-brand-primary countdown-bar"></div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.countdown-bar {
		animation: countdown 5s linear forwards;
	}

	@keyframes countdown {
		from { width: 100%; }
		to { width: 0%; }
	}
</style>
