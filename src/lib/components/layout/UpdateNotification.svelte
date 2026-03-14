<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let showUpdate = $state(false);

	onMount(() => {
		if (!browser || !('serviceWorker' in navigator)) return;

		navigator.serviceWorker.addEventListener('controllerchange', () => {
			showUpdate = true;
		});

		// Also check for waiting service worker on load
		navigator.serviceWorker.ready.then((registration) => {
			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				if (!newWorker) return;

				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
						showUpdate = true;
					}
				});
			});
		});
	});

	function handleUpdate() {
		window.location.reload();
	}
</script>

{#if showUpdate}
	<div class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-down">
		<button
			onclick={handleUpdate}
			class="flex items-center gap-3 bg-dark-surface border border-brand-500/30 rounded-xl px-4 py-3 shadow-lg shadow-brand-500/10"
		>
			<div class="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
				<svg class="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
			</div>
			<div class="text-left">
				<p class="text-sm font-medium text-white">มีเวอร์ชันใหม่</p>
				<p class="text-xs text-gray-400">กดเพื่ออัพเดท</p>
			</div>
		</button>
	</div>
{/if}

<style>
	@keyframes slide-down {
		from {
			opacity: 0;
			transform: translate(-50%, -1rem);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
	.animate-slide-down {
		animation: slide-down 0.3s ease-out;
	}
</style>
