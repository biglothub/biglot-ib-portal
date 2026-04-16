<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import TradePilotComposer from '$lib/components/portfolio/tradepilot/TradePilotComposer.svelte';
	import TradePilotEmptyState from '$lib/components/portfolio/tradepilot/TradePilotEmptyState.svelte';
	import TradePilotMessageRow from '$lib/components/portfolio/tradepilot/TradePilotMessageRow.svelte';
	import TradePilotSidebar from '$lib/components/portfolio/tradepilot/TradePilotSidebar.svelte';
	import { TRADEPILOT_MODE_OPTIONS, TRADEPILOT_STARTER_PROMPTS, filterTradePilotChats } from '$lib/tradepilot';
	import type { BigLotAiChat, BigLotAiMessage, BigLotAiMode } from '$lib/types';

	type MessageWithMeta = BigLotAiMessage;

	let chats = $state<BigLotAiChat[]>([]);
	let messages = $state<MessageWithMeta[]>([]);
	let currentChatId = $state<string | null>(null);
	let input = $state('');
	let currentMode = $state<BigLotAiMode>('portfolio');
	let loading = $state(false);
	let error = $state('');
	let ready = $state(false);
	let feedbackState = $state<Record<string, 'positive' | 'negative'>>({});
	let copiedMessageId = $state<string | null>(null);
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let scopeKey = $state('');
	let sidebarOpen = $state(false);
	let searchQuery = $state('');
	let stickToBottom = $state(true);
	let streamSummary = $state<string | null>(null);

	let currentAccountId = $derived($page.url.searchParams.get('account_id'));
	let activeModeMeta = $derived(TRADEPILOT_MODE_OPTIONS.find((mode) => mode.value === currentMode) ?? TRADEPILOT_MODE_OPTIONS[0]);
	let hasMessages = $derived(messages.length > 0);
	let filteredChats = $derived(filterTradePilotChats(chats, searchQuery));
	let currentChat = $derived(chats.find((chat) => chat.id === currentChatId) ?? null);
	let headerStatus = $derived(
		loading ? streamSummary || 'Thinking through your account context' : ready ? 'Ready' : 'Loading'
	);

	function apiQueryString(): string {
		const params = new URLSearchParams();
		const accountId = $page.url.searchParams.get('account_id');
		if (accountId) params.set('account_id', accountId);
		return params.toString() ? `?${params.toString()}` : '';
	}

	function pageHref(mode?: BigLotAiMode): string {
		const params = new URLSearchParams($page.url.searchParams);
		params.delete('starter');
		if (mode) params.set('mode', mode);
		const search = params.toString();
		return search ? `/portfolio/ai?${search}` : '/portfolio/ai';
	}

	function updateStickToBottom(): void {
		if (!messagesContainer) return;
		const distanceFromBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
		stickToBottom = distanceFromBottom < 120;
	}

	function scrollToBottom(force = false): void {
		requestAnimationFrame(() => {
			if (!messagesContainer) return;
			if (!force && !stickToBottom) return;
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		});
	}

	function setPrompt(prompt: string): void {
		input = prompt;
	}

	async function copyMessage(messageId: string, content: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(content);
			copiedMessageId = messageId;
			setTimeout(() => {
				if (copiedMessageId === messageId) copiedMessageId = null;
			}, 1800);
		} catch {
			error = 'คัดลอกข้อความไม่สำเร็จ';
		}
	}

	function formatChatTime(value: string | null): string {
		if (!value) return 'ยังไม่มีข้อความ';
		try {
			return new Date(value).toLocaleString('th-TH', {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return 'ยังไม่มีข้อความ';
		}
	}

	async function fetchMessages(chatId: string): Promise<MessageWithMeta[]> {
		const res = await fetch(`/api/biglot-ai/chats/${chatId}/messages${apiQueryString()}`);
		if (!res.ok) {
			throw new Error('ไม่สามารถโหลดข้อความได้');
		}

		const body = await res.json();
		return (body.messages ?? []) as MessageWithMeta[];
	}

	async function loadChats(): Promise<void> {
		const res = await fetch(`/api/biglot-ai/chats${apiQueryString()}`);
		if (!res.ok) {
			error = 'ไม่สามารถโหลด chats ได้';
			return;
		}

		const body = await res.json();
		chats = (body.chats ?? []) as BigLotAiChat[];

		if (currentChatId && !chats.some((chat) => chat.id === currentChatId)) {
			currentChatId = null;
		}

		if (!currentChatId && chats[0]) {
			await selectChat(chats[0].id);
		}

		if (!chats[0]) {
			messages = [];
		}
	}

	async function selectChat(chatId: string): Promise<void> {
		currentChatId = chatId;
		error = '';
		messages = await fetchMessages(chatId);
		scrollToBottom(true);
	}

	async function refreshCurrentChat(chatId: string | null): Promise<void> {
		if (!chatId) return;
		currentChatId = chatId;
		messages = await fetchMessages(chatId);
		scrollToBottom(true);
	}

	async function handleSelectChat(chatId: string): Promise<void> {
		sidebarOpen = false;
		await selectChat(chatId);
	}

	async function createChat(): Promise<void> {
		error = '';
		const res = await fetch(`/api/biglot-ai/chats${apiQueryString()}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});
		if (!res.ok) {
			error = 'ไม่สามารถสร้าง chat ใหม่ได้';
			return;
		}

		const body = await res.json();
		const chat = body.chat as BigLotAiChat;
		chats = [chat, ...chats];
		currentChatId = chat.id;
		messages = [];
		searchQuery = '';
		sidebarOpen = false;
	}

	async function archiveCurrentChat(): Promise<void> {
		if (!currentChatId) return;
		const archivedChatId = currentChatId;
		const res = await fetch(`/api/biglot-ai/chats${apiQueryString()}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'archive', chatId: currentChatId })
		});
		if (!res.ok) {
			error = 'ไม่สามารถ archive chat ได้';
			return;
		}

		if (currentChatId === archivedChatId) {
			currentChatId = null;
			messages = [];
		}

		await loadChats();
	}

	async function sendFeedback(messageId: string, feedback: 'positive' | 'negative', runId: string | null): Promise<void> {
		feedbackState[messageId] = feedback;
		await fetch(`/api/biglot-ai/feedback${apiQueryString()}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messageId, feedback, runId })
		}).catch(() => {});
	}

	async function sendMessage(starter?: string): Promise<void> {
		const content = (starter ?? input).trim();
		if (!content || loading) return;

		error = '';
		input = '';
		streamSummary = 'Preparing account context';

		const tempUserId = `tmp-user-${Date.now()}`;
		const tempAssistantId = `tmp-assistant-${Date.now()}`;
		const tempUser: MessageWithMeta = {
			id: tempUserId,
			chat_id: currentChatId ?? 'pending',
			run_id: null,
			role: 'user',
			mode: currentMode,
			content,
			citations: null,
			token_usage: null,
			status: 'completed',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		const tempAssistant: MessageWithMeta = {
			id: tempAssistantId,
			chat_id: currentChatId ?? 'pending',
			run_id: null,
			role: 'assistant',
			mode: currentMode,
			content: '',
			citations: null,
			token_usage: null,
			status: 'streaming',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};

		messages = [...messages, tempUser, tempAssistant];
		loading = true;
		stickToBottom = true;
		scrollToBottom(true);

		let streamChatId: string | null = currentChatId;
		let runStarted = false;

		try {
			const res = await fetch(`/api/biglot-ai/runs/stream${apiQueryString()}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chatId: currentChatId,
					mode: currentMode,
					message: content
				})
			});

			if (!res.ok || !res.body) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.message || 'ไม่สามารถส่งข้อความได้');
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.trim()) continue;
					const chunk = JSON.parse(line);

					if (chunk.type === 'status' && chunk.chat?.id) {
						runStarted = true;
						streamChatId = String(chunk.chat.id);
						currentChatId = streamChatId;
						streamSummary = 'Run started';
						messages = messages.map((message) =>
							message.id === tempUserId || message.id === tempAssistantId
								? { ...message, chat_id: streamChatId ?? message.chat_id }
								: message
						);

						if (!chats.some((chat) => chat.id === streamChatId)) {
							chats = [{
								id: streamChatId,
								owner_user_id: '',
								client_account_id: currentAccountId ?? '',
								surface_role: 'client',
								surface_context: 'portfolio',
								title: chunk.chat.title ?? 'TradePilot',
								last_message_at: new Date().toISOString(),
								archived_at: null,
								created_at: new Date().toISOString(),
								updated_at: new Date().toISOString()
							} as BigLotAiChat, ...chats];
						}
					}

					if (chunk.type === 'tool_use' && Array.isArray(chunk.tools) && chunk.tools.length > 0) {
						streamSummary = `Consulting ${chunk.tools.join(', ')}`;
					}

					if (chunk.type === 'citation' && typeof chunk.summary === 'string') {
						streamSummary = chunk.summary;
					}

					if (chunk.type === 'text_delta') {
						const delta = String(chunk.text ?? '');
						messages = messages.map((message) =>
							message.id === tempAssistantId
								? { ...message, content: message.content + delta }
								: message
						);
						scrollToBottom();
					}

					if (chunk.type === 'done') {
						const citations = Array.isArray(chunk.citations)
							? chunk.citations as MessageWithMeta['citations']
							: null;
						messages = messages.map((message) =>
							message.id === tempAssistantId
								? {
									...message,
									id: String(chunk.message_id ?? message.id),
									run_id: typeof chunk.run_id === 'string' ? chunk.run_id : null,
									citations,
									status: 'completed'
								}
								: message
						);
						streamSummary = null;
						await Promise.all([loadChats(), refreshCurrentChat(streamChatId)]);
					}

					if (chunk.type === 'error') {
						throw new Error(chunk.message || 'AI error');
					}
				}
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
			streamSummary = null;

			if (runStarted && streamChatId) {
				await Promise.all([loadChats(), refreshCurrentChat(streamChatId)]);
			} else {
				messages = messages.filter((message) => message.id !== tempUserId && message.id !== tempAssistantId);
			}
		} finally {
			loading = false;
		}
	}

	function setMode(mode: BigLotAiMode): void {
		currentMode = mode;
		sidebarOpen = false;
		goto(pageHref(mode), { replaceState: true, noScroll: true, keepFocus: true });
	}

	$effect(() => {
		const modeParam = $page.url.searchParams.get('mode');
		if (modeParam === 'portfolio' || modeParam === 'coach' || modeParam === 'gold' || modeParam === 'general') {
			currentMode = modeParam;
		}

		const starter = $page.url.searchParams.get('starter');
		if (starter && !messages.length && !loading && !input.trim()) {
			input = starter;
		}
	});

	$effect(() => {
		const nextScopeKey = apiQueryString();
		if (scopeKey === nextScopeKey) return;
		scopeKey = nextScopeKey;
		currentChatId = null;
		messages = [];
		searchQuery = '';
		ready = false;
		void loadChats().finally(() => {
			ready = true;
		});
	});
</script>

<svelte:head>
	<title>TradePilot</title>
</svelte:head>

<div class="tradepilot-shell">
	{#if sidebarOpen}
		<button class="tradepilot-backdrop" type="button" onclick={() => { sidebarOpen = false; }} aria-label="Close history"></button>
	{/if}

	<div class="tradepilot-frame">
		<TradePilotSidebar
			{ready}
			chats={chats}
			filteredChats={filteredChats}
			currentChatId={currentChatId}
			currentMode={currentMode}
			currentAccountId={currentAccountId}
			searchQuery={searchQuery}
			sidebarOpen={sidebarOpen}
			modeOptions={TRADEPILOT_MODE_OPTIONS}
			{formatChatTime}
			onToggleSidebar={() => { sidebarOpen = false; }}
			onCreateChat={createChat}
			onSelectChat={handleSelectChat}
			onArchiveCurrent={archiveCurrentChat}
			onModeChange={setMode}
			onSearchChange={(query) => { searchQuery = query; }}
		/>

		<section class="tradepilot-main">
			<header class="tradepilot-header">
				<div class="tradepilot-header__primary">
					<button class="tradepilot-header__toggle" type="button" onclick={() => { sidebarOpen = true; }} aria-label="Open history">
						☰
					</button>

					<div class="tradepilot-header__copy">
						<p class="tradepilot-header__eyebrow">{activeModeMeta.eyebrow}</p>
						<h1 class="tradepilot-header__title">{currentChat?.title || activeModeMeta.label}</h1>
						<p class="tradepilot-header__subtitle">
							{activeModeMeta.subtitle}{#if currentAccountId} · Account {currentAccountId}{/if}
						</p>
					</div>
				</div>

				<div class="tradepilot-header__meta">
					<span class="tradepilot-header__status">{headerStatus}</span>
					{#if currentChatId}
						<button class="tradepilot-header__action" type="button" onclick={archiveCurrentChat}>
							Archive
						</button>
					{/if}
				</div>
			</header>

			<div class="tradepilot-mode-strip">
				{#each TRADEPILOT_MODE_OPTIONS as option}
					<button
						type="button"
						class="tradepilot-mode-strip__item {currentMode === option.value ? 'is-active' : ''}"
						onclick={() => setMode(option.value)}
					>
						<span>{option.label}</span>
						<small>{option.eyebrow}</small>
					</button>
				{/each}
			</div>

			<div class="tradepilot-canvas" bind:this={messagesContainer} onscroll={updateStickToBottom}>
				{#if !hasMessages}
					<div class="tradepilot-empty-wrap">
						<TradePilotEmptyState
							mode={currentMode}
							modeMeta={activeModeMeta}
							prompts={TRADEPILOT_STARTER_PROMPTS[currentMode]}
							onSendStarter={sendMessage}
							onSetPrompt={setPrompt}
						/>
					</div>
				{:else}
					<div class="tradepilot-thread">
						{#each messages as message (message.id)}
							<TradePilotMessageRow
								{message}
								copiedMessageId={copiedMessageId}
								feedbackState={feedbackState}
								onCopy={copyMessage}
								onFeedback={sendFeedback}
							/>
						{/each}
					</div>
				{/if}
			</div>

			{#if error}
				<div class="tradepilot-error">{error}</div>
			{/if}

			<TradePilotComposer
				input={input}
				busy={loading}
				disabled={loading || !input.trim()}
				prompts={TRADEPILOT_STARTER_PROMPTS[currentMode]}
				streamSummary={streamSummary}
				onInput={(value) => { input = value; }}
				onSend={() => void sendMessage()}
				onSetPrompt={setPrompt}
			/>
		</section>
	</div>
</div>

<style>
	.tradepilot-shell {
		--tp-bg: #080808;
		--tp-panel: rgba(255, 255, 255, 0.03);
		--tp-panel-strong: rgba(255, 255, 255, 0.05);
		--tp-border: rgba(255, 255, 255, 0.08);
		--tp-gold: rgba(216, 184, 108, 0.92);
		position: relative;
		min-height: calc(100vh - 12rem);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 1.35rem;
		background:
			linear-gradient(180deg, rgba(11, 11, 11, 0.98), rgba(6, 6, 6, 0.98)),
			radial-gradient(circle at top, rgba(216, 184, 108, 0.08), transparent 38%);
		color: rgba(255, 255, 255, 0.94);
		overflow: clip;
	}

	.tradepilot-frame {
		display: grid;
		grid-template-columns: 20rem minmax(0, 1fr);
		min-height: calc(100vh - 12rem);
	}

	.tradepilot-main {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto auto;
		min-width: 0;
		padding: 1rem 1rem 0.9rem;
	}

	.tradepilot-header,
	.tradepilot-header__primary,
	.tradepilot-header__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.9rem;
	}

	.tradepilot-header {
		padding-bottom: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.tradepilot-header__copy {
		display: grid;
		gap: 0.25rem;
	}

	.tradepilot-header__eyebrow {
		margin: 0;
		font-size: 0.73rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(216, 184, 108, 0.86);
	}

	.tradepilot-header__title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 650;
		letter-spacing: -0.04em;
		color: rgba(250, 250, 249, 0.98);
	}

	.tradepilot-header__subtitle,
	.tradepilot-header__status {
		margin: 0;
		font-size: 0.8rem;
		color: rgba(161, 161, 170, 0.9);
	}

	.tradepilot-header__meta {
		justify-content: flex-end;
		flex-wrap: wrap;
	}

	.tradepilot-header__action,
	.tradepilot-mode-strip__item,
	.tradepilot-header__toggle {
		transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
	}

	.tradepilot-header__action {
		border: 1px solid var(--tp-border);
		border-radius: 999px;
		background: transparent;
		padding: 0.45rem 0.78rem;
		font-size: 0.76rem;
		color: rgba(212, 212, 216, 0.88);
	}

	.tradepilot-header__action:hover {
		background: var(--tp-panel-strong);
	}

	.tradepilot-header__toggle {
		display: none;
		align-items: center;
		justify-content: center;
		width: 2.3rem;
		height: 2.3rem;
		border: 1px solid var(--tp-border);
		border-radius: 0.85rem;
		background: var(--tp-panel);
		color: rgba(245, 245, 244, 0.92);
	}

	.tradepilot-mode-strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.6rem;
		padding: 0.95rem 0 0.8rem;
	}

	.tradepilot-mode-strip__item {
		display: grid;
		gap: 0.16rem;
		padding: 0.75rem 0.82rem;
		border: 1px solid var(--tp-border);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.02);
		text-align: left;
		color: rgba(245, 245, 244, 0.92);
	}

	.tradepilot-mode-strip__item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.tradepilot-mode-strip__item.is-active {
		border-color: rgba(216, 184, 108, 0.28);
		background: rgba(216, 184, 108, 0.08);
	}

	.tradepilot-mode-strip__item span {
		font-size: 0.84rem;
		font-weight: 600;
	}

	.tradepilot-mode-strip__item small {
		font-size: 0.72rem;
		color: rgba(161, 161, 170, 0.9);
	}

	.tradepilot-canvas {
		min-height: 0;
		overflow-y: auto;
		padding: 0.55rem 0 0.85rem;
	}

	.tradepilot-thread {
		display: grid;
		gap: 1.1rem;
		width: min(100%, 53rem);
		margin: 0 auto;
	}

	.tradepilot-empty-wrap {
		display: flex;
		min-height: 100%;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 0;
	}

	.tradepilot-error {
		margin-top: 0.25rem;
		font-size: 0.82rem;
		color: rgba(252, 165, 165, 0.96);
	}

	.tradepilot-backdrop {
		position: fixed;
		inset: 0;
		z-index: 30;
		border: 0;
		background: rgba(0, 0, 0, 0.56);
	}

	@media (max-width: 1024px) {
		.tradepilot-frame {
			grid-template-columns: minmax(0, 1fr);
		}

		.tradepilot-header__toggle {
			display: inline-flex;
		}
	}

	@media (max-width: 840px) {
		.tradepilot-mode-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 720px) {
		.tradepilot-shell {
			min-height: calc(100vh - 9rem);
			border-radius: 1rem;
		}

		.tradepilot-main {
			padding-inline: 0.8rem;
		}

		.tradepilot-header {
			align-items: flex-start;
			flex-direction: column;
		}

		.tradepilot-header__primary,
		.tradepilot-header__meta {
			width: 100%;
		}

		.tradepilot-mode-strip {
			grid-template-columns: 1fr;
		}
	}
</style>
