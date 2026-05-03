<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { focusTrap } from '$lib/actions/focusTrap';

	let {
		open,
		title,
		onclose,
		initialFocus,
		children
	}: {
		open: boolean;
		title: string;
		onclose: () => void;
		initialFocus?: string;
		children: Snippet;
	} = $props();

	let dragStartY = $state(0);
	let dragDelta = $state(0);
	let keyboardOffset = $state(0);
	let isDragging = $state(false);

	function close() {
		onclose();
		dragDelta = 0;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		}
	}

	function handleTouchStart(event: TouchEvent) {
		dragStartY = event.touches[0].clientY;
		isDragging = true;
		dragDelta = 0;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isDragging) return;
		dragDelta = Math.max(0, event.touches[0].clientY - dragStartY);
	}

	function handleTouchEnd() {
		isDragging = false;
		if (dragDelta > 80) close();
		else dragDelta = 0;
	}

	$effect(() => {
		if (!open || !window.visualViewport) return;

		const viewport = window.visualViewport;
		const update = () => {
			const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
			keyboardOffset = covered;
		};

		update();
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);
		return () => {
			viewport.removeEventListener('resize', update);
			viewport.removeEventListener('scroll', update);
			keyboardOffset = 0;
		};
	});
</script>

{#if open}
	<button
		type="button"
		transition:fade={{ duration: 180 }}
		class="md:hidden fixed inset-0 z-[49] bg-black/60"
		onclick={close}
		aria-label="ปิด"
	></button>

	<div
		use:focusTrap={{ enabled: open, initialFocus }}
		class="md:hidden fixed left-0 right-0 z-[50] rounded-t-2xl bg-dark-surface shadow-2xl animate-slide-up"
		style="bottom: {keyboardOffset}px; transform: translateY({dragDelta}px); transition: {isDragging ? 'none' : 'transform 180ms ease, bottom 180ms ease'}"
		role="dialog"
		aria-modal="true"
		aria-labelledby="bottom-sheet-title"
		tabindex="-1"
		onkeydown={handleKeydown}
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing"
			ontouchstart={handleTouchStart}
			ontouchmove={handleTouchMove}
			ontouchend={handleTouchEnd}
		>
			<div class="h-1 w-10 rounded-full bg-dark-border"></div>
		</div>
		<div class="max-h-[85vh] overflow-y-auto px-4 pb-6 pwa-safe-bottom">
			<div class="mb-4 flex items-center justify-between">
				<h2 id="bottom-sheet-title" class="text-base font-semibold text-white">{title}</h2>
				<button
					type="button"
					onclick={close}
					class="pwa-min-touch -mr-2 flex items-center justify-center rounded-full bg-dark-hover text-gray-400 transition-colors hover:text-white"
					aria-label="ปิด"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			{@render children()}
		</div>
	</div>
{/if}
