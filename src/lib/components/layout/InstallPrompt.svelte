<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let show = $state(false);

	onMount(() => {
		if (!browser) return;

		// Check if iOS Safari and NOT already in standalone mode
		const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as any).standalone === true;

		if (!isIos || isStandalone) return;

		// Check if dismissed recently
		const dismissed = localStorage.getItem('pwa-install-dismissed');
		if (dismissed) {
			const dismissedAt = parseInt(dismissed, 10);
			const sevenDays = 7 * 24 * 60 * 60 * 1000;
			if (Date.now() - dismissedAt < sevenDays) return;
		}

		// Show after a short delay
		setTimeout(() => {
			show = true;
		}, 3000);
	});

	function dismiss() {
		show = false;
		localStorage.setItem('pwa-install-dismissed', Date.now().toString());
	}
</script>

{#if show}
	<div class="fixed bottom-0 inset-x-0 z-[90] p-4 pwa-safe-bottom animate-slide-up">
		<div class="bg-dark-surface border border-dark-border rounded-2xl p-4 max-w-md mx-auto shadow-xl">
			<div class="flex items-start gap-3">
				<div class="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center shrink-0">
					<span class="text-[#3b82f6] font-bold text-lg">IB</span>
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="text-sm font-semibold text-white">เพิ่ม IB Portal ลงหน้าจอ</h3>
					<p class="text-xs text-gray-400 mt-1">
						กดปุ่ม
						<svg class="inline w-4 h-4 text-brand-400 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
						แชร์ แล้วเลือก <strong class="text-white">"เพิ่มในหน้าจอโฮม"</strong>
					</p>
				</div>
				<button
					onclick={dismiss}
					class="shrink-0 p-1 text-gray-500 hover:text-white transition-colors"
					aria-label="ปิด"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-slide-up {
		animation: slide-up 0.3s ease-out;
	}
</style>
