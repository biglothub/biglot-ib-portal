<script lang="ts">
	import type { BigLotAiChat, BigLotAiMode } from '$lib/types';
	import type { TradePilotModeOption } from '$lib/tradepilot';

	interface Props {
		sidebarOpen: boolean;
		ready: boolean;
		chats: BigLotAiChat[];
		filteredChats: BigLotAiChat[];
		currentChatId: string | null;
		currentMode: BigLotAiMode;
		currentAccountId: string | null;
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
		ready,
		chats,
		filteredChats,
		currentChatId,
		currentMode,
		currentAccountId,
		searchQuery,
		modeOptions,
		formatChatTime,
		onToggleSidebar,
		onCreateChat,
		onSelectChat,
		onArchiveCurrent,
		onModeChange,
		onSearchChange
	}: Props = $props();
</script>

<aside class="tp-rail" class:is-open={sidebarOpen}>
	<div class="tp-rail__hero">
		<div>
			<p class="tp-rail__eyebrow">TradePilot</p>
			<h2 class="tp-rail__title">Scoped chat history</h2>
		</div>
		<button class="tp-rail__close" type="button" onclick={() => onToggleSidebar?.()} aria-label="Close history">
			✕
		</button>
	</div>

	<div class="tp-rail__account">
		<span class="tp-rail__account-label">Active scope</span>
		<strong>{currentAccountId ? `Account ${currentAccountId}` : 'Current portfolio'}</strong>
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

	<div class="tp-rail__modes">
		{#each modeOptions as option}
			<button
				type="button"
				class="tp-rail__mode {currentMode === option.value ? 'is-active' : ''}"
				onclick={() => onModeChange?.(option.value)}
			>
				<span class="tp-rail__mode-eyebrow">{option.eyebrow}</span>
				<span class="tp-rail__mode-label">{option.label}</span>
				<span class="tp-rail__mode-copy">{option.subtitle}</span>
			</button>
		{/each}
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
					>
						<span class="tp-rail__history-title">{chat.title || 'TradePilot'}</span>
						<span class="tp-rail__history-time">{formatChatTime(chat.last_message_at)}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if currentChatId}
		<button class="tp-rail__archive" type="button" onclick={() => onArchiveCurrent?.()}>
			Archive selected chat
		</button>
	{/if}
</aside>

<style>
	.tp-rail {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background:
			linear-gradient(180deg, rgba(18, 18, 18, 0.98), rgba(11, 11, 11, 0.96)),
			radial-gradient(circle at top left, rgba(201, 168, 76, 0.12), transparent 44%);
		border-right: 1px solid rgba(255, 255, 255, 0.06);
	}

	.tp-rail__hero,
	.tp-rail__history-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.tp-rail__eyebrow,
	.tp-rail__mode-eyebrow,
	.tp-rail__account-label {
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
	.tp-rail__mode,
	.tp-rail__history-item,
	.tp-rail__archive {
		transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
	}

	.tp-rail__close {
		display: none;
		border: 0;
		background: transparent;
		padding: 0.15rem 0.25rem;
		color: rgba(229, 231, 235, 0.72);
		font-size: 1rem;
	}

	.tp-rail__account,
	.tp-rail__search,
	.tp-rail__new,
	.tp-rail__archive,
	.tp-rail__history-item,
	.tp-rail__mode {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
	}

	.tp-rail__account {
		padding: 0.9rem 1rem;
		background: rgba(255, 255, 255, 0.03);
		color: rgba(231, 229, 228, 0.92);
	}

	.tp-rail__account strong {
		display: block;
		margin-top: 0.32rem;
		font-size: 0.92rem;
		font-weight: 600;
		word-break: break-word;
	}

	.tp-rail__new,
	.tp-rail__archive {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		padding: 0.9rem 1rem;
		background: rgba(201, 168, 76, 0.1);
		color: rgba(255, 248, 230, 0.94);
		font-size: 0.86rem;
		font-weight: 600;
	}

	.tp-rail__new:hover,
	.tp-rail__archive:hover {
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

	.tp-rail__modes {
		display: grid;
		gap: 0.6rem;
	}

	.tp-rail__mode {
		display: grid;
		gap: 0.22rem;
		background: rgba(255, 255, 255, 0.02);
		padding: 0.85rem 0.95rem;
		text-align: left;
		color: rgba(245, 245, 244, 0.9);
	}

	.tp-rail__mode:hover,
	.tp-rail__history-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.tp-rail__mode.is-active,
	.tp-rail__history-item.is-active {
		border-color: rgba(216, 184, 108, 0.28);
		background: rgba(216, 184, 108, 0.09);
	}

	.tp-rail__mode-label,
	.tp-rail__history-title {
		font-size: 0.86rem;
		font-weight: 600;
	}

	.tp-rail__mode-copy,
	.tp-rail__history-time,
	.tp-rail__history-head {
		font-size: 0.76rem;
		line-height: 1.45;
		color: rgba(161, 161, 170, 0.86);
	}

	.tp-rail__history {
		display: flex;
		min-height: 0;
		flex: 1 1 auto;
		flex-direction: column;
		gap: 0.7rem;
	}

	.tp-rail__history-head {
		align-items: center;
	}

	.tp-rail__history-list {
		display: grid;
		gap: 0.55rem;
		overflow-y: auto;
	}

	.tp-rail__history-item {
		display: grid;
		gap: 0.24rem;
		background: rgba(255, 255, 255, 0.01);
		padding: 0.82rem 0.9rem;
		text-align: left;
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
			width: min(21rem, 88vw);
			transform: translateX(-105%);
			transition: transform 180ms ease;
			border-right-color: rgba(255, 255, 255, 0.08);
			box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
		}

		.tp-rail.is-open {
			transform: translateX(0);
		}

		.tp-rail__close {
			display: inline-flex;
		}
	}
</style>

