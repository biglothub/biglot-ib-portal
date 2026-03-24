<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let showIos = $state(false);
	let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
	let showAndroid = $state(false);

	onMount(() => {
		if (!browser) return;

		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;

		if (isStandalone) return;

		const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);

		if (isIos) {
			// iOS Safari path
			const dismissed = localStorage.getItem('pwa-install-dismissed');
			if (dismissed) {
				const dismissedAt = parseInt(dismissed, 10);
				const sevenDays = 7 * 24 * 60 * 60 * 1000;
				if (Date.now() - dismissedAt < sevenDays) return;
			}
			setTimeout(() => {
				showIos = true;
			}, 3000);
		} else {
			// Android Chrome path — listen for beforeinstallprompt
			const handler = (e: Event) => {
				e.preventDefault();
				const dismissed = localStorage.getItem('pwa-android-dismissed');
				if (dismissed) {
					const dismissedAt = parseInt(dismissed, 10);
					const sevenDays = 7 * 24 * 60 * 60 * 1000;
					if (Date.now() - dismissedAt < sevenDays) return;
				}
				deferredPrompt = e as BeforeInstallPromptEvent;
				showAndroid = true;
			};
			window.addEventListener('beforeinstallprompt', handler);
			return () => {
				window.removeEventListener('beforeinstallprompt', handler);
			};
		}
	});

	function dismissIos() {
		showIos = false;
		localStorage.setItem('pwa-install-dismissed', Date.now().toString());
	}

	function dismissAndroid() {
		showAndroid = false;
		deferredPrompt = null;
		localStorage.setItem('pwa-android-dismissed', Date.now().toString());
	}

	async function installAndroid() {
		if (!deferredPrompt) return;
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			showAndroid = false;
		}
		deferredPrompt = null;
	}
</script>

{#if showIos}
	<!-- iOS Safari install instructions -->
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
					onclick={dismissIos}
					class="shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
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

{#if showAndroid}
	<!-- Android Chrome install prompt -->
	<div class="fixed bottom-0 inset-x-0 z-[90] p-4 pwa-safe-bottom animate-slide-up">
		<div class="bg-dark-surface border border-dark-border rounded-2xl p-4 max-w-md mx-auto shadow-xl">
			<div class="flex items-start gap-3">
				<div class="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center shrink-0">
					<svg class="w-6 h-6 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
					</svg>
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="text-sm font-semibold text-white">ติดตั้งแอป IB Portal</h3>
					<p class="text-xs text-gray-400 mt-1">เปิดใช้งานได้เร็วขึ้นจาก Home Screen</p>
					<button
						onclick={installAndroid}
						class="mt-2.5 px-4 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold rounded-lg transition-colors"
					>
						ติดตั้ง
					</button>
				</div>
				<button
					onclick={dismissAndroid}
					class="shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
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
