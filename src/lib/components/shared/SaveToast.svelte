<script lang="ts">
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { getToasts, dismiss } from '$lib/stores/toast.svelte';

	const toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
	<div
		class="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 flex flex-col-reverse gap-2 w-full max-w-xs pointer-events-none"
		aria-live="polite"
		aria-label="การแจ้งเตือน"
	>
		{#each toasts as t (t.id)}
			<div
				animate:flip={{ duration: 200 }}
				transition:fly={{ x: 60, duration: 250 }}
				class="pointer-events-auto relative overflow-hidden rounded-xl shadow-2xl border flex items-start gap-3 px-4 py-3
					{t.type === 'success' ? 'bg-[#0f2820] border-green-500/40' :
					 t.type === 'error'   ? 'bg-[#2a1010] border-red-500/40' :
					                        'bg-dark-surface border-dark-border'}"
				role="alert"
			>
				<!-- Icon -->
				<div class="mt-0.5 shrink-0">
					{#if t.type === 'success'}
						<div class="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
							<svg class="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
							</svg>
						</div>
					{:else if t.type === 'error'}
						<div class="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
							<svg class="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/>
							</svg>
						</div>
					{:else}
						<div class="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
							<svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01"/>
							</svg>
						</div>
					{/if}
				</div>

				<!-- Text -->
				<div class="flex-1 min-w-0">
					<p class="text-sm font-semibold
						{t.type === 'success' ? 'text-green-300' :
						 t.type === 'error'   ? 'text-red-300' :
						                        'text-gray-200'}">
						{t.title}
					</p>
					{#if t.detail}
						<p class="mt-0.5 text-xs text-gray-400 truncate">{t.detail}</p>
					{/if}
				</div>

				<!-- Dismiss button -->
				<button
					type="button"
					onclick={() => dismiss(t.id)}
					class="shrink-0 text-gray-500 hover:text-gray-300 transition-colors -mt-0.5 -mr-1"
					aria-label="ปิด"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>

				<!-- Countdown bar -->
				<div class="absolute bottom-0 left-0 right-0 h-0.5
					{t.type === 'success' ? 'bg-green-500/20' :
					 t.type === 'error'   ? 'bg-red-500/20' :
					                        'bg-blue-500/20'}">
					<div class="h-full countdown-bar
						{t.type === 'success' ? 'bg-green-500' :
						 t.type === 'error'   ? 'bg-red-500' :
						                        'bg-blue-500'}">
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.countdown-bar {
		animation: countdown 4.5s linear forwards;
	}
	@keyframes countdown {
		from { width: 100%; }
		to { width: 0%; }
	}
</style>
