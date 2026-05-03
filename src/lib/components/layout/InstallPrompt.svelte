<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import IOSInstallSteps from '$lib/components/pwa/IOSInstallSteps.svelte';
	import { usePlatform } from '$lib/pwa/use-platform.svelte';
	import {
		PWA_INSTALL_DISMISSED_AT_KEY,
		PWA_INSTALL_OPEN_EVENT,
		useInstallPromptEvent
	} from '$lib/pwa/install-event.svelte';

	type InstallState = 'eligible' | 'snoozed' | 'installed' | 'unsupported' | 'dismissed';

	const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
	const platform = usePlatform();
	const installPrompt = useInstallPromptEvent(true);

	let installState = $state<InstallState>('unsupported');
	let sheetOpen = $state(false);
	let autoTimer: ReturnType<typeof setTimeout> | null = null;

	const canShowSheet = $derived(
		platform.isMobile && !platform.isStandalone && installState === 'eligible'
	);

	function readDismissedAt(): number | null {
		if (!browser) return null;
		const raw = localStorage.getItem(PWA_INSTALL_DISMISSED_AT_KEY);
		if (!raw) return null;
		const value = Number.parseInt(raw, 10);
		return Number.isFinite(value) ? value : null;
	}

	function resolveInstallState(): InstallState {
		if (!browser) return 'unsupported';
		if (platform.isStandalone || installPrompt.installed) return 'installed';
		if (!platform.isMobile) return 'unsupported';
		const dismissedAt = readDismissedAt();
		if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return 'snoozed';
		if (platform.isIOS || platform.isAndroid || installPrompt.canPrompt) return 'eligible';
		return 'unsupported';
	}

	function openSheet({ bypassSnooze = false } = {}) {
		if (!browser || platform.isStandalone || !platform.isMobile) return;
		if (!bypassSnooze && installState === 'snoozed') return;
		installState = 'eligible';
		sheetOpen = true;
	}

	function dismiss() {
		sheetOpen = false;
		installState = 'dismissed';
		localStorage.setItem(PWA_INSTALL_DISMISSED_AT_KEY, Date.now().toString());
	}

	async function installNow() {
		if (platform.isAndroid && installPrompt.canPrompt) {
			const outcome = await installPrompt.prompt();
			if (outcome === 'accepted') {
				sheetOpen = false;
				installState = 'installed';
				return;
			}
		}
		sheetOpen = true;
	}

	onMount(() => {
		const handleManualOpen = () => openSheet({ bypassSnooze: true });
		window.addEventListener(PWA_INSTALL_OPEN_EVENT, handleManualOpen);
		return () => {
			window.removeEventListener(PWA_INSTALL_OPEN_EVENT, handleManualOpen);
			if (autoTimer) clearTimeout(autoTimer);
		};
	});

	$effect(() => {
		installState = resolveInstallState();

		if (autoTimer) {
			clearTimeout(autoTimer);
			autoTimer = null;
		}

		if (canShowSheet && !sheetOpen) {
			autoTimer = setTimeout(() => openSheet(), 3000);
		}
	});
</script>

{#if sheetOpen && platform.isMobile && !platform.isStandalone}
	<div class="md:hidden fixed inset-x-0 bottom-0 z-[40] p-4 pwa-safe-bottom animate-slide-up">
		<div
			class="mx-auto max-w-md rounded-2xl border border-dark-border bg-dark-surface p-4 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="install-prompt-title"
		>
			<div class="flex items-start gap-3">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1e3a5f]">
					<span class="text-lg font-bold text-[#3b82f6]">IB</span>
				</div>
				<div class="min-w-0 flex-1">
					<h3 id="install-prompt-title" class="text-sm font-semibold text-white">
						{platform.isIOS ? 'เพิ่ม IB Portal ลงหน้าจอโฮม' : 'ติดตั้งแอป IB Portal'}
					</h3>
					<p class="mt-1 text-xs leading-relaxed text-gray-400">
						เปิดดูพอร์ตได้เร็วขึ้น และรับการแจ้งเตือนสำคัญ
					</p>
				</div>
				<button
					type="button"
					onclick={dismiss}
					class="pwa-min-touch -mr-2 -mt-2 flex shrink-0 items-center justify-center text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
					aria-label="ปิด"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			{#if platform.isIOS}
				<IOSInstallSteps />
			{:else}
				<div class="mt-3 rounded-lg border border-dark-border bg-dark-bg/70 px-3 py-2 text-xs leading-relaxed text-gray-400">
					{installPrompt.canPrompt
						? 'กดติดตั้งเลยเพื่อเพิ่ม IB Portal ไปที่ Home Screen'
						: 'เปิดเมนูของ Chrome แล้วเลือกติดตั้งแอปเมื่อเบราว์เซอร์รองรับ'}
				</div>
			{/if}

			<div class="mt-4 flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={dismiss}
					class="pwa-min-touch rounded-lg px-4 py-2 text-xs font-medium text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
				>
					ไว้ทีหลัง
				</button>
				<button
					type="button"
					onclick={installNow}
					class="pwa-min-touch rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
				>
					ติดตั้งเลย
				</button>
			</div>
		</div>
	</div>
{/if}
