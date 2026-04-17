<script lang="ts">
	import type { BigLotAiChat } from '$lib/types';

	interface Props {
		sidebarOpen: boolean;
		desktopCollapsed?: boolean;
		ready: boolean;
		chats: BigLotAiChat[];
		filteredChats: BigLotAiChat[];
		currentChatId: string | null;
		searchQuery: string;
		formatChatTime: (value: string | null) => string;
		onToggleSidebar?: () => void;
		onCreateChat?: () => void;
		onSelectChat?: (chatId: string) => void;
		onArchiveCurrent?: () => void;
		onSearchChange?: (query: string) => void;
	}

	let {
		sidebarOpen,
		desktopCollapsed = false,
		ready,
		chats,
		filteredChats,
		currentChatId,
		searchQuery,
		formatChatTime,
		onToggleSidebar,
		onCreateChat,
		onSelectChat,
		onArchiveCurrent,
		onSearchChange
	}: Props = $props();
</script>

<aside class="tp-rail" class:is-open={sidebarOpen} class:is-desktop-collapsed={desktopCollapsed}>
	<div class="tp-rail__head">
		<div class="tp-rail__brand">
			<span class="tp-rail__brand-mark" aria-hidden="true">◐</span>
			<span class="tp-rail__brand-name">TradePilot</span>
		</div>
		<button class="tp-rail__close" type="button" onclick={() => onToggleSidebar?.()} aria-label="Close history">
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg>
		</button>
	</div>

	<button class="tp-rail__new" type="button" onclick={() => onCreateChat?.()}>
		<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M6.5 2v9M2 6.5h9"/></svg>
		<span>New conversation</span>
	</button>

	<div class="tp-rail__search-wrap">
		<svg class="tp-rail__search-icon" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><circle cx="5.5" cy="5.5" r="3.8"/><path d="M8.5 8.5l2.5 2.5" stroke-linecap="round"/></svg>
		<input
			class="tp-rail__search"
			type="text"
			placeholder="Search"
			value={searchQuery}
			oninput={(event) => onSearchChange?.((event.currentTarget as HTMLInputElement).value)}
		/>
	</div>

	<div class="tp-rail__history">
		<div class="tp-rail__history-head">
			<span>Recent</span>
			<span class="tp-rail__count">{filteredChats.length}</span>
		</div>

		{#if !ready}
			<div class="tp-rail__empty">Loading…</div>
		{:else if chats.length === 0}
			<div class="tp-rail__empty">No conversations yet.</div>
		{:else if filteredChats.length === 0}
			<div class="tp-rail__empty">No matches.</div>
		{:else}
			<div class="tp-rail__history-list">
				{#each filteredChats as chat}
					<div
						class="tp-rail__item {currentChatId === chat.id ? 'is-active' : ''}"
						title={formatChatTime(chat.last_message_at)}
					>
						<button
							type="button"
							class="tp-rail__item-select"
							onclick={() => onSelectChat?.(chat.id)}
						>
							<span class="tp-rail__item-title">{chat.title || 'Untitled'}</span>
							<span class="tp-rail__item-time">{formatChatTime(chat.last_message_at)}</span>
						</button>
						{#if currentChatId === chat.id}
							<button
								type="button"
								class="tp-rail__item-archive"
								onclick={() => onArchiveCurrent?.()}
								title="Archive"
								aria-label="Archive chat"
							>
								<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 2l7 7M9 2l-7 7"/></svg>
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</aside>

<style>
	.tp-rail {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 1rem;
		padding: 1.1rem 0.85rem 1rem;
		background: #0a0a0b;
		border-right: 1px solid rgba(255, 255, 255, 0.05);
	}

	.tp-rail__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.15rem 0.45rem;
	}

	.tp-rail__brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tp-rail__brand-mark {
		font-size: 0.85rem;
		color: var(--tp-accent, #c9a86c);
		line-height: 1;
	}

	.tp-rail__brand-name {
		font-family: var(--tp-font-display, 'Newsreader', Georgia, serif);
		font-size: 1.05rem;
		font-style: italic;
		font-weight: 400;
		letter-spacing: -0.01em;
		color: rgba(237, 237, 234, 0.95);
	}

	.tp-rail__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.65rem;
		height: 1.65rem;
		border: 0;
		background: transparent;
		color: rgba(180, 180, 175, 0.7);
		border-radius: 0.4rem;
		cursor: pointer;
		transition: background-color 140ms ease, color 140ms ease;
	}

	.tp-rail__close:hover {
		background: rgba(255, 255, 255, 0.05);
		color: rgba(237, 237, 234, 0.95);
	}

	.tp-rail__new {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.55rem;
		background: transparent;
		color: rgba(237, 237, 234, 0.9);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		letter-spacing: -0.005em;
		cursor: pointer;
		transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease;
	}

	.tp-rail__new:hover {
		border-color: rgba(255, 255, 255, 0.16);
		background: rgba(255, 255, 255, 0.025);
		color: rgba(255, 255, 255, 0.98);
	}

	.tp-rail__search-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.tp-rail__search-icon {
		position: absolute;
		left: 0.65rem;
		color: rgba(140, 140, 138, 0.6);
		pointer-events: none;
	}

	.tp-rail__search {
		width: 100%;
		padding: 0.55rem 0.7rem 0.55rem 1.85rem;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.03);
		color: rgba(237, 237, 234, 0.95);
		font-family: inherit;
		font-size: 0.8rem;
		outline: none;
		transition: border-color 140ms ease, background-color 140ms ease;
	}

	.tp-rail__search::placeholder {
		color: rgba(140, 140, 138, 0.65);
	}

	.tp-rail__search:focus {
		border-color: rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
	}

	.tp-rail__history {
		display: flex;
		min-height: 0;
		flex: 1 1 0;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tp-rail__history-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0.5rem;
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(140, 140, 138, 0.65);
	}

	.tp-rail__count {
		font-variant-numeric: tabular-nums;
		color: rgba(140, 140, 138, 0.5);
	}

	.tp-rail__history-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
	}

	.tp-rail__history-list::-webkit-scrollbar {
		width: 6px;
	}

	.tp-rail__history-list::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 999px;
	}

	.tp-rail__item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		border-radius: 0.45rem;
		transition: background-color 130ms ease;
	}

	.tp-rail__item:hover {
		background: rgba(255, 255, 255, 0.035);
	}

	.tp-rail__item.is-active {
		background: rgba(255, 255, 255, 0.05);
	}

	.tp-rail__item.is-active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.5rem;
		bottom: 0.5rem;
		width: 2px;
		border-radius: 0 2px 2px 0;
		background: var(--tp-accent, #c9a86c);
	}

	.tp-rail__item-select {
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
		flex: 1 1 0;
		min-width: 0;
		border: 0;
		background: transparent;
		padding: 0.5rem 0.65rem;
		text-align: left;
		color: inherit;
		cursor: pointer;
		font-family: inherit;
	}

	.tp-rail__item-title {
		font-size: 0.81rem;
		font-weight: 450;
		color: rgba(228, 228, 222, 0.92);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: -0.005em;
	}

	.tp-rail__item.is-active .tp-rail__item-title {
		color: rgba(255, 255, 255, 0.98);
	}

	.tp-rail__item-time {
		font-size: 0.66rem;
		color: rgba(140, 140, 138, 0.55);
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tp-rail__item-archive {
		flex-shrink: 0;
		opacity: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		margin-right: 0.35rem;
		border: 0;
		background: transparent;
		border-radius: 0.35rem;
		color: rgba(180, 180, 175, 0.55);
		transition: opacity 140ms ease, background-color 140ms ease, color 140ms ease;
		padding: 0;
		cursor: pointer;
	}

	.tp-rail__item:hover .tp-rail__item-archive,
	.tp-rail__item.is-active .tp-rail__item-archive {
		opacity: 1;
	}

	.tp-rail__item-archive:hover {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(237, 237, 234, 0.95);
	}

	@media (hover: none) {
		.tp-rail__item.is-active .tp-rail__item-archive {
			opacity: 1;
		}
	}

	.tp-rail__empty {
		padding: 0.85rem 0.5rem;
		font-size: 0.76rem;
		color: rgba(140, 140, 138, 0.65);
	}

	@media (max-width: 1024px) {
		.tp-rail {
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			z-index: 40;
			width: min(17rem, 88vw);
			transform: translateX(-105%);
			transition: transform 200ms cubic-bezier(0.32, 0.72, 0.24, 1);
			box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
		}

		.tp-rail.is-open {
			transform: translateX(0);
		}
	}

	@media (min-width: 1025px) {
		.tp-rail.is-desktop-collapsed {
			position: absolute;
			top: 0;
			left: 0;
			bottom: 0;
			width: 17rem;
			transform: translateX(-105%);
			pointer-events: none;
		}
	}
</style>
