<script lang="ts">
	import { dashboardLayout } from '$lib/stores/dashboardLayout.svelte';
	import { fly } from 'svelte/transition';

	let { onclose }: { onclose: () => void } = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
	onclick={onclose}
></div>

<!-- Panel -->
<div
	class="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-dark-surface border-l border-dark-border shadow-2xl flex flex-col"
	transition:fly={{ x: 384, duration: 250 }}
	role="dialog"
	aria-label="ปรับแต่งแดชบอร์ด"
>
	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-4 border-b border-dark-border">
		<div>
			<h2 class="text-lg font-semibold text-white">ปรับแต่งแดชบอร์ด</h2>
			<p class="text-xs text-gray-400 mt-0.5">เลือกและจัดลำดับ widget ที่ต้องการแสดง</p>
		</div>
		<button
			onclick={onclose}
			class="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-dark-bg/50 transition-colors"
			aria-label="ปิด"
		>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<!-- Widget list -->
	<div class="flex-1 overflow-y-auto px-5 py-4 space-y-1.5">
		{#each dashboardLayout.widgets as widget, idx (widget.id)}
			<div class="flex items-center gap-3 rounded-xl border border-dark-border bg-dark-bg/30 px-3 py-2.5 group hover:border-dark-border/80">
				<!-- Checkbox -->
				<label class="flex items-center cursor-pointer">
					<input
						type="checkbox"
						checked={widget.visible}
						onchange={() => dashboardLayout.toggleWidget(widget.id)}
						class="h-4 w-4 rounded border-dark-border bg-dark-bg text-brand-primary focus:ring-brand-primary/30 focus:ring-offset-0 cursor-pointer"
					/>
				</label>

				<!-- Label -->
				<span class="flex-1 text-sm text-gray-300 select-none {widget.visible ? '' : 'opacity-40'}">
					{widget.label}
				</span>

				<!-- Reorder buttons -->
				<div class="flex items-center gap-0.5">
					<button
						onclick={() => dashboardLayout.moveWidget(widget.id, 'up')}
						disabled={idx === 0}
						class="rounded p-1 text-gray-500 hover:text-white hover:bg-dark-bg/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
						aria-label="เลื่อนขึ้น"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
						</svg>
					</button>
					<button
						onclick={() => dashboardLayout.moveWidget(widget.id, 'down')}
						disabled={idx === dashboardLayout.widgets.length - 1}
						class="rounded p-1 text-gray-500 hover:text-white hover:bg-dark-bg/50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
						aria-label="เลื่อนลง"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
				</div>
			</div>
		{/each}
	</div>

	<!-- Footer -->
	<div class="px-5 py-4 border-t border-dark-border flex items-center justify-between gap-3">
		<button
			onclick={() => dashboardLayout.resetLayout()}
			class="rounded-xl border border-dark-border px-4 py-2 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
		>
			รีเซ็ต
		</button>
		<div class="flex items-center gap-2">
			{#if dashboardLayout.saving}
				<span class="text-xs text-gray-400">กำลังบันทึก...</span>
			{:else if dashboardLayout.saveError}
				<span class="text-xs text-red-400">{dashboardLayout.saveError}</span>
			{/if}
			<button
				onclick={onclose}
				class="rounded-xl bg-brand-primary px-5 py-2 text-sm font-medium text-dark-bg hover:bg-brand-primary/90 transition-colors"
			>
				เสร็จสิ้น
			</button>
		</div>
	</div>
</div>
