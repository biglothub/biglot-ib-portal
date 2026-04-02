<script lang="ts">
	import { focusTrap } from '$lib/actions/focusTrap';
	import { getShortcuts } from '$lib/stores/shortcuts.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const shortcuts = $derived(getShortcuts());
	const OVERLAY_ID = 'shortcuts-help';

	// Group display order
	const groupOrder = ['การนำทาง', 'การค้นหา', 'อื่นๆ'];

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function formatKey(k: string): string {
		if (k === 'Escape') return 'Esc';
		if (k === 'Cmd' || k === 'Meta') return '⌘';
		if (k === 'Control') return 'Ctrl';
		return k;
	}

	function keySeparator(key: string): string {
		const modifierPattern = /^(Cmd|Meta|Control|Ctrl|Alt|Shift)\+/;
		return modifierPattern.test(key) ? '+' : 'then';
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		onclick={handleBackdropClick}
	>
		<div
			use:focusTrap={{ id: OVERLAY_ID, enabled: open, initialFocus: '[data-shortcuts-close]', lockScroll: true }}
			role="dialog"
			aria-modal="true"
			aria-label="Keyboard Shortcuts"
			tabindex="-1"
			class="bg-dark-surface border border-dark-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto focus:outline-none"
			onescape={onclose}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-dark-border sticky top-0 bg-dark-surface">
				<h2 class="text-base font-semibold text-white">Keyboard Shortcuts</h2>
				<button
					data-shortcuts-close
					onclick={onclose}
					class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-border/60 transition-colors"
					aria-label="ปิด"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Body -->
			<div class="px-5 py-4 space-y-6">
				{#each groupOrder as groupName}
					{@const registeredInGroup = shortcuts.filter((s) => s.group === groupName)}
					{#if registeredInGroup.length > 0}
						<section>
							<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{groupName}</h3>
							<div class="space-y-2">
								{#each registeredInGroup as s}
									<div class="flex items-center justify-between gap-4">
										<span class="text-sm text-gray-300">{s.description}</span>
										<div class="flex items-center gap-2 shrink-0">
											{#each s.keys as key, keyIndex}
												<div class="flex items-center gap-1">
													{#if keyIndex > 0}
														<span class="text-gray-400 text-xs">/</span>
													{/if}
													{#each key.split('+') as part, i}
														{#if i > 0}
															<span class="text-gray-400 text-xs">{keySeparator(key)}</span>
														{/if}
														<kbd class="bg-dark-bg border border-dark-border rounded px-1.5 py-0.5 text-xs font-mono text-gray-200">
															{formatKey(part)}
														</kbd>
													{/each}
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</section>
					{/if}
				{/each}

				<!-- Chord hint -->
				<p class="text-xs text-gray-400 border-t border-dark-border pt-4">
					Chord shortcuts: กด <kbd class="bg-dark-bg border border-dark-border rounded px-1 py-0.5 text-xs font-mono text-gray-400">g</kbd> แล้วกดตามด้วยคีย์ภายใน 500ms
				</p>
			</div>
		</div>
	</div>
{/if}
