<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { browser } from '$app/environment';

	const LAST_ONLINE_KEY = 'pwa.lastOnlineAt';
	const PENDING_SYNC_COUNT_KEY = 'pwa.pending.count';

	type NetworkState = 'online' | 'offline' | 'reconnecting' | 'cached';

	let online = $state(true);
	let networkState = $state<NetworkState>('online');
	let justReconnected = $state(false);
	let lastOnlineAt = $state<number | null>(null);
	let pendingCount = $state(0);
	let reconnectedTimer: ReturnType<typeof setTimeout> | null = null;

	const lastOnlineTime = $derived(
		lastOnlineAt
			? new Intl.DateTimeFormat('th-TH', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				}).format(new Date(lastOnlineAt))
			: null
	);

	function readPendingCount(): number {
		if (!browser) return 0;
		const raw = localStorage.getItem(PENDING_SYNC_COUNT_KEY);
		const value = raw ? Number.parseInt(raw, 10) : 0;
		return Number.isFinite(value) ? Math.max(0, value) : 0;
	}

	function markOnline() {
		online = true;
		networkState = 'online';
		lastOnlineAt = Date.now();
		localStorage.setItem(LAST_ONLINE_KEY, String(lastOnlineAt));
	}

	function openSyncCenter() {
		if (!browser) return;
		window.dispatchEvent(new CustomEvent('pwa:open-sync-center'));
	}

	$effect(() => {
		if (!browser) return;

		const storedLastOnlineAt = localStorage.getItem(LAST_ONLINE_KEY);
		lastOnlineAt = storedLastOnlineAt ? Number.parseInt(storedLastOnlineAt, 10) : Date.now();
		pendingCount = readPendingCount();
		online = navigator.onLine;
		networkState = online ? 'online' : 'offline';
		if (online) {
			localStorage.setItem(LAST_ONLINE_KEY, String(lastOnlineAt));
		}

		function handleOffline() {
			online = false;
			networkState = 'offline';
			pendingCount = readPendingCount();
		}

		async function handleOnline() {
			networkState = 'reconnecting';
			justReconnected = true;
			if (reconnectedTimer) clearTimeout(reconnectedTimer);
			reconnectedTimer = setTimeout(() => {
				justReconnected = false;
			}, 3000);
			await invalidate('portfolio:baseData');
			markOnline();
			pendingCount = readPendingCount();
		}

		function handleStorage(event: StorageEvent) {
			if (event.key === PENDING_SYNC_COUNT_KEY) {
				pendingCount = readPendingCount();
			}
		}

		window.addEventListener('offline', handleOffline);
		window.addEventListener('online', handleOnline);
		window.addEventListener('storage', handleStorage);

		return () => {
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('storage', handleStorage);
			if (reconnectedTimer) clearTimeout(reconnectedTimer);
		};
	});
</script>

{#if !online}
	<div
		class="fixed top-0 inset-x-0 z-[60] bg-red-900/90 border-b border-red-700/60 px-4 py-2 pwa-safe-top flex items-center justify-center gap-2"
		role="status"
		aria-live="polite"
	>
		<svg class="w-4 h-4 text-red-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<line x1="2" y1="2" x2="22" y2="22" stroke-linecap="round" stroke-width="2" />
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.5 16.5a5 5 0 017 0M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M12 20h.01" />
		</svg>
		<span class="min-w-0 text-xs text-red-200">
			{networkState === 'cached' ? 'แคช' : 'ออฟไลน์'} - กำลังแสดงข้อมูลที่บันทึกไว้ล่าสุด{lastOnlineTime ? ` ${lastOnlineTime}` : ''}
		</span>
		{#if pendingCount > 0}
			<button
				type="button"
				onclick={openSyncCenter}
				class="shrink-0 rounded-md border border-red-400/40 px-2 py-1 text-[11px] font-medium text-red-100 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
			>
				ดูรายการรอซิงก์
			</button>
		{/if}
	</div>
{/if}

{#if justReconnected}
	<div
		class="fixed bottom-24 md:bottom-8 right-4 z-[35] flex items-center gap-2 bg-dark-surface border border-green-500/30 rounded-full px-4 py-2 pwa-safe-bottom shadow-lg"
		role="status"
		aria-live="polite"
	>
		<span class="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0"></span>
		<span class="text-xs text-green-400 font-medium whitespace-nowrap">
			เชื่อมต่อแล้ว{pendingCount > 0 ? ` - กำลังซิงก์ ${pendingCount} รายการ` : ''}
		</span>
	</div>
{/if}
