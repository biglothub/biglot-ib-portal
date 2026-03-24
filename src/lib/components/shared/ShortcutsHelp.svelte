<script lang="ts">
	import { getShortcuts } from '$lib/stores/shortcuts.svelte';
	import type { ShortcutDef } from '$lib/stores/shortcuts.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const shortcuts = $derived(getShortcuts());

	// Group shortcuts for display
	const grouped = $derived.by(() => {
		const groups = new Map<string, ShortcutDef[]>();
		for (const s of shortcuts) {
			if (!groups.has(s.group)) groups.set(s.group, []);
			groups.get(s.group)!.push(s);
		}
		return groups;
	});

	// Group display order + additional static entries
	const groupOrder = ['การนำทาง', 'การค้นหา', 'อื่นๆ'];

	// Static shortcuts not in registry (search shortcut hint)
	const staticShortcuts: Record<string, Array<{ keys: string[]; description: string }>> = {
		'การค้นหา': [
			{ keys: ['/'], description: 'ค้นหา' },
			{ keys: ['Cmd', 'K'], description: 'Command palette' }
		]
	};

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function formatKey(k: string): string {
		if (k === 'Escape') return 'Esc';
		if (k === 'Cmd') return '⌘';
		return k;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		role="dialog"
		aria-modal="true"
		aria-label="Keyboard Shortcuts"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<div class="bg-dark-surface border border-dark-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-dark-border sticky top-0 bg-dark-surface">
				<h2 class="text-base font-semibold text-white">Keyboard Shortcuts</h2>
				<button
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
					{@const staticInGroup = staticShortcuts[groupName] ?? []}
					{#if registeredInGroup.length > 0 || staticInGroup.length > 0}
						<section>
							<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{groupName}</h3>
							<div class="space-y-2">
								{#each registeredInGroup as s}
									<div class="flex items-center justify-between gap-4">
										<span class="text-sm text-gray-300">{s.description}</span>
										<div class="flex items-center gap-1 shrink-0">
											{#each s.keys[0].split('+') as part, i}
												{#if i > 0}
													<span class="text-gray-400 text-xs">then</span>
												{/if}
												<kbd class="bg-dark-bg border border-dark-border rounded px-1.5 py-0.5 text-xs font-mono text-gray-200">
													{formatKey(part)}
												</kbd>
											{/each}
										</div>
									</div>
								{/each}
								{#each staticInGroup as s}
									<div class="flex items-center justify-between gap-4">
										<span class="text-sm text-gray-300">{s.description}</span>
										<div class="flex items-center gap-1 shrink-0">
											{#each s.keys as k, i}
												{#if i > 0}
													<span class="text-gray-400 text-xs">/</span>
												{/if}
												<kbd class="bg-dark-bg border border-dark-border rounded px-1.5 py-0.5 text-xs font-mono text-gray-200">
													{formatKey(k)}
												</kbd>
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
