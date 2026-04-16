<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toast, formatSavedTime } from '$lib/stores/toast.svelte';
	import { focusTrap } from '$lib/actions/focusTrap';
	import TiptapEditor from '$lib/components/portfolio/TiptapEditor.svelte';
	import { formatCurrency } from '$lib/utils';

	let {
		date,
		netPnl,
		totalTrades,
		winRate,
		onsaved = () => {},
		onclose
	}: {
		date: string;
		netPnl: number;
		totalTrades: number;
		winRate: number;
		onsaved?: () => void;
		onclose: () => void;
	} = $props();

	let content = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let savedAt = $state<Date | null>(null);
	let error = $state('');

	// Format date header (e.g. "จันทร์ 6 เม.ย. 2569")
	function formatDateHeader(dateStr: string) {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
	}

	// Load existing journal on mount — only track `date` to avoid re-runs on keystroke
	$effect(() => {
		const d = date;
		fetch(`/api/portfolio/journal?date=${encodeURIComponent(d)}`)
			.then(r => r.json())
			.then(({ journal }) => {
				if (journal?.post_market_notes) content = journal.post_market_notes;
				loading = false;
			})
			.catch((err) => {
				loading = false;
				error = err instanceof Error ? err.message : 'Failed to load journal';
			});
	});

	function save() {
		if (saving) return;
		saving = true;
		_doSave();
	}

	async function _doSave() {
		try {
			const res = await fetch('/api/portfolio/journal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date,
					post_market_notes: content,
					completion_status: content.trim() ? 'in_progress' : 'not_started'
				})
			});
			if (res.ok) {
				saved = true;
				savedAt = new Date();
				onsaved();
				toast.success('บันทึก Day Note แล้ว', { detail: date });
				setTimeout(() => { saved = false; }, 2500);
			} else {
				error = 'ไม่สามารถบันทึกได้ กรุณาลองใหม่';
				toast.error('บันทึก Day Note ไม่สำเร็จ');
			}
		} catch {
			error = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		} finally {
			saving = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			save();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
	transition:fade={{ duration: 150 }}
	onclick={onclose}
	aria-hidden="true"
></div>

<!-- Drawer -->
<div
	class="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-dark-surface rounded-t-2xl shadow-2xl max-h-[90vh]"
	style="max-height: min(90vh, 640px)"
	transition:fly={{ y: 400, duration: 250 }}
	use:focusTrap={{ enabled: true }}
	role="dialog"
	aria-modal="true"
	aria-label="บันทึกประจำวัน"
>
	<!-- Handle -->
	<div class="flex justify-center pt-3 pb-1">
		<div class="w-10 h-1 bg-gray-700 rounded-full"></div>
	</div>

	<!-- Header -->
	<div class="flex items-start justify-between px-5 py-3 border-b border-gray-700/40">
		<div>
			<div class="flex items-center gap-2">
				<h2 class="text-sm font-semibold text-white">Day view</h2>
				<span class="text-[11px] text-gray-500">·</span>
				<span class="text-sm font-medium {netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
					Net P&L {formatCurrency(netPnl)}
				</span>
			</div>
			<div class="text-xs text-gray-400 mt-0.5">
				{formatDateHeader(date)} · {totalTrades} trades · {winRate.toFixed(0)}% win rate
			</div>
		</div>
		<div class="flex items-center gap-2">
			<a
				href="/portfolio/journal?date={date}"
				class="flex items-center gap-1.5 text-xs text-brand-primary hover:underline"
				target="_blank"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
				</svg>
				View in Journal
			</a>
			<button
				onclick={onclose}
				class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors"
				aria-label="ปิด"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Editor -->
	<div class="flex-1 overflow-y-auto px-5 py-3 min-h-0">
		{#if loading}
			<div class="flex items-center justify-center h-32 text-gray-500 text-sm">กำลังโหลด...</div>
		{:else if error}
			<div class="flex items-center justify-center h-32 text-red-400 text-sm">{error}</div>
		{:else}
			<TiptapEditor
				{content}
				placeholder="Write something, or press &quot;/&quot; for commands"
				onupdate={(html) => { content = html; }}
			/>
		{/if}
	</div>

	<!-- Footer -->
	<div class="flex items-center justify-between px-5 py-3 border-t border-gray-700/40">
		<div class="flex flex-col gap-0.5">
			<span class="text-[11px] text-gray-500">⌘S บันทึก</span>
			{#if savedAt}
				<span class="text-[11px] text-green-500/70 flex items-center gap-1">
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
					{formatSavedTime(savedAt)}
				</span>
			{/if}
		</div>
		<button
			onclick={save}
			disabled={saving}
			class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
				disabled:opacity-50 transition-all
				{saved ? 'bg-green-500 text-white' : 'bg-brand-primary text-dark-bg hover:bg-brand-primary/90'}"
		>
			{#if saving}
				<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
				</svg>
				กำลังบันทึก...
			{:else if saved}
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
				บันทึกแล้ว!
			{:else}
				Save
			{/if}
		</button>
	</div>
</div>
