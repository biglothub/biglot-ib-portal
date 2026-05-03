<script lang="ts">
	import { fade } from 'svelte/transition';
	import { focusTrap } from '$lib/actions/focusTrap';
	import { listDrafts, listPendingActions, listSnapshots, clearSnapshots, type PendingActionRecord } from '$lib/pwa/offline-db';
	import {
		flushSyncQueue,
		initSyncQueueRuntime,
		PWA_SYNC_EVENT
	} from '$lib/pwa/sync-queue';

	let open = $state(false);
	let pending = $state<PendingActionRecord[]>([]);
	let draftCount = $state(0);
	let snapshotCount = $state(0);
	let flushing = $state(false);
	let lastSyncAt = $state<number | null>(null);
	let message = $state('');

	const pendingFailed = $derived(pending.filter((item) => item.lastError));

	const lastSyncText = $derived(
		lastSyncAt
			? new Intl.DateTimeFormat('th-TH', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				}).format(new Date(lastSyncAt))
			: 'ยังไม่เคยซิงก์ในเครื่องนี้'
	);

	async function refresh() {
		const [pendingActions, drafts, snapshots] = await Promise.all([
			listPendingActions(),
			listDrafts(),
			listSnapshots()
		]);
		pending = pendingActions;
		draftCount = drafts.length;
		snapshotCount = snapshots.length;
	}

	async function retry() {
		flushing = true;
		message = '';
		const result = await flushSyncQueue({ force: true });
		lastSyncAt = Date.now();
		message = result.failed > 0 ? 'ยังมีบางรายการซิงก์ไม่สำเร็จ' : 'ซิงก์รายการที่รอแล้ว';
		await refresh();
		flushing = false;
	}

	async function clearCache() {
		await clearSnapshots();
		await refresh();
		message = 'ล้าง cache ของหน้าแล้ว';
	}

	function close() {
		open = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}

	$effect(() => initSyncQueueRuntime());

	$effect(() => {
		const openCenter = async () => {
			open = true;
			await refresh();
		};
		const update = async (event: Event) => {
			const detail = (event as CustomEvent).detail ?? {};
			if (typeof detail.flushing === 'boolean') flushing = detail.flushing;
			if (detail.lastSyncAt) lastSyncAt = detail.lastSyncAt;
			await refresh();
		};

		window.addEventListener('pwa:open-sync-center', openCenter);
		window.addEventListener(PWA_SYNC_EVENT, update);
		refresh().catch(() => undefined);

		return () => {
			window.removeEventListener('pwa:open-sync-center', openCenter);
			window.removeEventListener(PWA_SYNC_EVENT, update);
		};
	});
</script>

{#if open}
	<button
		type="button"
		transition:fade={{ duration: 160 }}
		class="md:hidden fixed inset-0 z-[39] bg-black/55"
		aria-label="ปิด Sync Center"
		onclick={close}
	></button>

	<div
		use:focusTrap={{ enabled: open }}
		class="md:hidden fixed inset-x-0 bottom-0 z-[40] max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-dark-border bg-dark-surface p-4 pwa-safe-bottom shadow-2xl animate-slide-up"
		role="dialog"
		aria-modal="true"
		aria-labelledby="sync-center-title"
		tabindex="-1"
		onkeydown={handleKeydown}
	>
		<div class="mx-auto mb-4 h-1 w-10 rounded-full bg-dark-border"></div>
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 id="sync-center-title" class="text-base font-semibold text-white">Sync Center</h2>
				<p class="mt-1 text-xs text-gray-400">ซิงก์ล่าสุด: {lastSyncText}</p>
			</div>
			<button
				type="button"
				onclick={close}
				class="pwa-min-touch -mr-2 -mt-2 flex items-center justify-center rounded-lg text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
				aria-label="ปิด"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="mt-4 grid grid-cols-3 gap-2">
			<div class="rounded-xl border border-dark-border bg-dark-bg/60 p-3">
				<div class="text-lg font-semibold text-white">{pending.length}</div>
				<div class="text-[11px] text-gray-400">รอซิงก์</div>
			</div>
			<div class="rounded-xl border border-dark-border bg-dark-bg/60 p-3">
				<div class="text-lg font-semibold text-white">{draftCount}</div>
				<div class="text-[11px] text-gray-400">แบบร่าง</div>
			</div>
			<div class="rounded-xl border border-dark-border bg-dark-bg/60 p-3">
				<div class="text-lg font-semibold text-white">{snapshotCount}</div>
				<div class="text-[11px] text-gray-400">cache</div>
			</div>
		</div>

		{#if pending.length > 0}
			<div class="mt-4 space-y-2">
				<p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Pending</p>
				{#each pending as item}
					<div class="rounded-xl border border-dark-border bg-dark-bg/50 p-3">
						<div class="flex items-center justify-between gap-3">
							<p class="min-w-0 truncate text-xs font-medium text-white">{item.method} {item.endpoint}</p>
							<span class="shrink-0 text-[11px] text-gray-500">{item.attempts} ครั้ง</span>
						</div>
						{#if item.lastError}
							<p class="mt-1 line-clamp-2 text-[11px] text-red-400">{item.lastError}</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if pendingFailed.length > 0}
			<p class="mt-3 text-xs text-red-400">มี {pendingFailed.length} รายการที่ต้อง retry</p>
		{/if}

		{#if message}
			<p class="mt-3 text-xs text-green-400" role="status" aria-live="polite">{message}</p>
		{/if}

		<div class="mt-5 flex gap-2">
			<button
				type="button"
				onclick={retry}
				disabled={flushing || pending.length === 0}
				class="pwa-min-touch flex-1 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{flushing ? 'กำลังซิงก์...' : 'Retry ทั้งหมด'}
			</button>
			<button
				type="button"
				onclick={clearCache}
				class="pwa-min-touch rounded-lg border border-dark-border px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
			>
				Clear cache
			</button>
		</div>
	</div>
{/if}
