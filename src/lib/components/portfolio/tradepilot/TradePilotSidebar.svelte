<script lang="ts">
	import type { BigLotAiChat, BigLotAiMode } from '$lib/types';
	import type { TradePilotModeOption } from '$lib/tradepilot';

	interface Props {
		sidebarOpen: boolean;
		desktopCollapsed?: boolean;
		ready: boolean;
		chats: BigLotAiChat[];
		filteredChats: BigLotAiChat[];
		currentChatId: string | null;
		currentMode: BigLotAiMode;
		searchQuery: string;
		modeOptions: TradePilotModeOption[];
		formatChatTime: (value: string | null) => string;
		onToggleSidebar?: () => void;
		onCreateChat?: () => void;
		onSelectChat?: (chatId: string) => void;
		onArchiveCurrent?: () => void;
		onModeChange?: (mode: BigLotAiMode) => void;
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
	<div class="tp-rail__hero">
		<div>
			<p class="tp-rail__eyebrow">BigLot.ai</p>
			<h2 class="tp-rail__title">TradePilot</h2>
		</div>
		<button class="tp-rail__close" type="button" onclick={() => onToggleSidebar?.()} aria-label="Close history">
			✕
		</button>
	</div>

	<button class="tp-rail__new" type="button" onclick={() => onCreateChat?.()}>
		<span class="tp-rail__plus">+</span>
		<span>New chat</span>
	</button>

	<div class="tp-rail__search-wrap">
		<input
			class="tp-rail__search"
			type="text"
			placeholder="Search chats"
			value={searchQuery}
			oninput={(event) => onSearchChange?.((event.currentTarget as HTMLInputElement).value)}
		/>
	</div>

	<div class="tp-rail__history">
		<div class="tp-rail__history-head">
			<span>Conversations</span>
			<span>{filteredChats.length}</span>
		</div>

		{#if !ready}
			<div class="tp-rail__empty">Loading history…</div>
		{:else if chats.length === 0}
			<div class="tp-rail__empty">ยังไม่มี chat สำหรับ account นี้</div>
		{:else if filteredChats.length === 0}
			<div class="tp-rail__empty">ไม่พบ chat ที่ตรงกับคำค้น</div>
		{:else}
			<div class="tp-rail__history-list">
				{#each filteredChats as chat}
					<button
						type="button"
						class="tp-rail__history-item {currentChatId === chat.id ? 'is-active' : ''}"
						onclick={() => onSelectChat?.(chat.id)}
						title={formatChatTime(chat.last_message_at)}
					>
						<span class="tp-rail__history-icon" aria-hidden="true">●</span>
						<span class="tp-rail__history-title">{chat.title || 'TradePilot'}</span>
						{#if currentChatId === chat.id}
							<span
								role="button"
								tabindex="0"
								class="tp-rail__history-delete"
								onclick={(e) => { e.stopPropagation(); onArchiveCurrent?.(); }}
								onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onArchiveCurrent?.(); } }}
								title="Archive chat"
								aria-label="Archive chat"
							>
								✕
							</span>
						{/if}
					</button>
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
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(18, 18, 18, 0.82);
		backdrop-filter: blur(14px);
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}

	.tp-rail__hero,
	.tp-rail__history-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.tp-rail__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(216, 184, 108, 0.86);
	}

	.tp-rail__title {
		margin: 0.28rem 0 0;
		font-size: 1.05rem;
		font-weight: 650;
		letter-spacing: -0.03em;
		color: rgba(248, 247, 243, 0.96);
	}

	.tp-rail__close,
	.tp-rail__new,
	.tp-rail__history-item {
		transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
	}

	.tp-rail__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 0;
		background: transparent;
		padding: 0.15rem 0.25rem;
		color: rgba(229, 231, 235, 0.72);
		font-size: 1rem;
		border-radius: 999px;
	}

	.tp-rail__close:hover {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.92);
	}

	.tp-rail__search,
	.tp-rail__new,
	.tp-rail__history-item {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
	}

	.tp-rail__new {
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.55rem;
		padding: 0.9rem 1rem;
		background: rgba(201, 168, 76, 0.1);
		color: rgba(255, 248, 230, 0.94);
		font-size: 0.86rem;
		font-weight: 600;
	}

	.tp-rail__new:hover {
		background: rgba(201, 168, 76, 0.16);
		border-color: rgba(201, 168, 76, 0.26);
	}

	.tp-rail__plus {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.3rem;
		height: 1.3rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		font-size: 1rem;
		line-height: 1;
	}

	.tp-rail__search-wrap {
		display: grid;
	}

	.tp-rail__search {
		width: 100%;
		padding: 0.82rem 0.95rem;
		background: rgba(255, 255, 255, 0.03);
		color: rgba(245, 245, 244, 0.94);
		outline: none;
	}

	.tp-rail__search::placeholder {
		color: rgba(161, 161, 170, 0.78);
	}

	.tp-rail__search:focus {
		border-color: rgba(216, 184, 108, 0.3);
	}

	.tp-rail__history {
		display: flex;
		min-height: 0;
		flex: 1 1 0;
		flex-direction: column;
		gap: 0.7rem;
	}

	.tp-rail__history-head {
		align-items: center;
		font-size: 0.76rem;
		line-height: 1.45;
		color: rgba(161, 161, 170, 0.86);
	}

	.tp-rail__history-list {
		display: grid;
		gap: 0.4rem;
		overflow-y: auto;
	}

	.tp-rail__history-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		background: rgba(255, 255, 255, 0.01);
		padding: 0.72rem 0.9rem;
		text-align: left;
		overflow: hidden;
	}

	.tp-rail__history-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.tp-rail__history-item.is-active {
		border-color: rgba(216, 184, 108, 0.28);
		background: rgba(216, 184, 108, 0.09);
	}

	.tp-rail__history-icon {
		flex-shrink: 0;
		font-size: 0.45rem;
		color: rgba(161, 161, 170, 0.55);
	}

	.tp-rail__history-title {
		flex: 1 1 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.84rem;
		font-weight: 500;
		color: rgba(245, 245, 244, 0.88);
	}

	.tp-rail__history-delete {
		flex-shrink: 0;
		opacity: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.3rem;
		height: 1.3rem;
		border: 0;
		background: transparent;
		border-radius: 999px;
		font-size: 0.62rem;
		color: rgba(248, 113, 113, 0.7);
		transition: opacity 140ms ease, background-color 140ms ease;
		padding: 0;
	}

	.tp-rail__history-item:hover .tp-rail__history-delete,
	.tp-rail__history-item.is-active .tp-rail__history-delete {
		opacity: 1;
	}

	.tp-rail__history-delete:hover {
		background: rgba(248, 113, 113, 0.12);
		color: rgba(248, 113, 113, 0.95);
	}

	.tp-rail__empty {
		padding: 1rem 0.15rem;
		font-size: 0.8rem;
		line-height: 1.55;
		color: rgba(161, 161, 170, 0.9);
	}

	@media (max-width: 1024px) {
		.tp-rail {
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			z-index: 40;
			width: min(16rem, 88vw);
			transform: translateX(-105%);
			transition: transform 180ms ease;
			border-right-color: rgba(255, 255, 255, 0.08);
			box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
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
			width: 16rem;
			transform: translateX(-105%);
			pointer-events: none;
			box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
		}
	}
</style>
