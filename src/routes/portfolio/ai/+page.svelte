<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AiChatMessage from '$lib/components/portfolio/AiChatMessage.svelte';
	import type { BigLotAiChat, BigLotAiMessage, BigLotAiMode } from '$lib/types';

	type MessageWithMeta = BigLotAiMessage;

	const modeOptions: Array<{ value: BigLotAiMode; label: string; subtitle: string }> = [
		{ value: 'portfolio', label: 'Portfolio Q&A', subtitle: 'ถามเรื่อง performance, trades, reports' },
		{ value: 'coach', label: 'Coach', subtitle: 'โฟกัสวินัย, mistakes, recurring patterns' },
		{ value: 'gold', label: 'Gold Analyst', subtitle: 'วิเคราะห์ XAUUSD ด้วย context ล่าสุด' },
		{ value: 'general', label: 'General', subtitle: 'ใช้เป็นผู้ช่วยทั่วไป แต่ยังยึด account นี้เป็นแกน' }
	];

	const starterPrompts: Record<BigLotAiMode, string[]> = {
		portfolio: [
			'สรุปผลงานการเทรด 7 วันล่าสุดให้หน่อย',
			'เทรดคู่เงินไหนทำกำไรดีที่สุดใน 30 วันล่าสุด',
			'ช่วยอธิบายว่าฉันเสียเงินกับ pattern ไหนบ่อยสุด'
		],
		coach: [
			'จุดอ่อนหลักในการเทรดของฉันตอนนี้คืออะไร',
			'ช่วยสรุป recurring mistakes จาก trades และ reviews ล่าสุด',
			'วาง checklist ก่อนเข้าเทรดให้ฉันจากพฤติกรรมที่พลาดบ่อย'
		],
		gold: [
			'สรุป bias ทองคำวันนี้ให้หน่อย',
			'ถ้าจะเทรด XAUUSD วันนี้ควรระวังระดับราคาไหน',
			'เทียบ playbook ของฉันกับ context ทองตอนนี้ให้หน่อย'
		],
		general: [
			'ช่วยสรุปสิ่งที่ฉันควรโฟกัสในวันนี้แบบสั้น ๆ',
			'ช่วยแปลงข้อมูลพอร์ตล่าสุดเป็น daily briefing',
			'ฉันควรคุยกับ AI นี้ยังไงให้ได้ insight ดีที่สุด'
		]
	};

	let chats = $state<BigLotAiChat[]>([]);
	let messages = $state<MessageWithMeta[]>([]);
	let currentChatId = $state<string | null>(null);
	let input = $state('');
	let currentMode = $state<BigLotAiMode>('portfolio');
	let loading = $state(false);
	let error = $state('');
	let ready = $state(false);
	let feedbackState = $state<Record<string, 'positive' | 'negative'>>({});
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let scopeKey = $state('');
	let currentAccountId = $derived($page.url.searchParams.get('account_id'));
	let activeModeMeta = $derived(modeOptions.find((mode) => mode.value === currentMode) ?? modeOptions[0]);
	let hasMessages = $derived(messages.length > 0);

	function apiQueryString(): string {
		const params = new URLSearchParams();
		const accountId = $page.url.searchParams.get('account_id');
		if (accountId) params.set('account_id', accountId);
		return params.toString() ? `?${params.toString()}` : '';
	}

	function pageHref(mode?: BigLotAiMode): string {
		const params = new URLSearchParams($page.url.searchParams);
		if (mode) params.set('mode', mode);
		const search = params.toString();
		return search ? `/portfolio/ai?${search}` : '/portfolio/ai';
	}

	function scrollToBottom(): void {
		requestAnimationFrame(() => {
			if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
		});
	}

	async function loadChats(): Promise<void> {
		const res = await fetch(`/api/biglot-ai/chats${apiQueryString()}`);
		if (!res.ok) {
			error = 'ไม่สามารถโหลด chats ได้';
			return;
		}

		const body = await res.json();
		chats = (body.chats ?? []) as BigLotAiChat[];
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
		const res = await fetch(`/api/biglot-ai/chats/${chatId}/messages${apiQueryString()}`);
		if (!res.ok) {
			error = 'ไม่สามารถโหลดข้อความได้';
			return;
		}

		const body = await res.json();
		messages = (body.messages ?? []) as MessageWithMeta[];
		scrollToBottom();
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
	}

	async function archiveCurrentChat(): Promise<void> {
		if (!currentChatId) return;
		const res = await fetch(`/api/biglot-ai/chats${apiQueryString()}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'archive', chatId: currentChatId })
		});
		if (!res.ok) {
			error = 'ไม่สามารถ archive chat ได้';
			return;
		}

		chats = chats.filter((chat) => chat.id !== currentChatId);
		currentChatId = chats[0]?.id ?? null;
		if (currentChatId) {
			await selectChat(currentChatId);
		} else {
			messages = [];
		}
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
		const tempUser: MessageWithMeta = {
			id: `tmp-user-${Date.now()}`,
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
			id: `tmp-assistant-${Date.now()}`,
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
		scrollToBottom();

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
						currentChatId = chunk.chat.id as string;
						const existing = chats.find((chat) => chat.id === chunk.chat.id);
						if (!existing) {
							chats = [{
								id: chunk.chat.id,
								owner_user_id: '',
								client_account_id: '',
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

					if (chunk.type === 'text_delta') {
						messages[messages.length - 1].content += String(chunk.text ?? '');
						scrollToBottom();
					}

					if (chunk.type === 'done') {
						messages[messages.length - 1].id = String(chunk.message_id ?? messages[messages.length - 1].id);
						messages[messages.length - 1].run_id = typeof chunk.run_id === 'string' ? chunk.run_id : null;
						messages[messages.length - 1].citations = Array.isArray(chunk.citations)
							? chunk.citations as MessageWithMeta['citations']
							: null;
						messages[messages.length - 1].status = 'completed';
						await loadChats();
					}

					if (chunk.type === 'error') {
						throw new Error(chunk.message || 'AI error');
					}
				}
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
			messages = messages.slice(0, -1);
		} finally {
			loading = false;
		}
	}

	function setMode(mode: BigLotAiMode): void {
		currentMode = mode;
		goto(pageHref(mode), { replaceState: true, noScroll: true, keepFocus: true });
	}

	$effect(() => {
		const modeParam = $page.url.searchParams.get('mode');
		if (modeParam === 'portfolio' || modeParam === 'coach' || modeParam === 'gold' || modeParam === 'general') {
			currentMode = modeParam;
		}
		const starter = $page.url.searchParams.get('starter');
		if (starter && !messages.length && !loading) {
			input = starter;
		}
	});

	$effect(() => {
		const nextScopeKey = `${apiQueryString()}::${$page.url.searchParams.get('mode') ?? 'portfolio'}`;
		if (scopeKey === nextScopeKey) return;
		scopeKey = nextScopeKey;
		currentChatId = null;
		messages = [];
		void loadChats().then(() => {
			ready = true;
		});
	});
</script>

<svelte:head>
	<title>TradePilot</title>
</svelte:head>

<div class="tp-shell">
	<div class="tp-orb tp-orb-a"></div>
	<div class="tp-orb tp-orb-b"></div>

	<div class="tp-grid">
		<aside class="tp-rail">
			<div class="tp-brand">
				<div>
					<p class="tp-kicker">Private Trading Intelligence</p>
					<h1 class="tp-display">TradePilot</h1>
				</div>
				<button class="tp-ghost-button" onclick={createChat}>New Thread</button>
			</div>

			<div class="tp-scope">
				<span class="tp-pill">Scoped Workspace</span>
				<p class="tp-scope-copy">
					{#if currentAccountId}
						Account context: {currentAccountId}
					{:else}
						Active account context is inherited from the current portfolio view.
					{/if}
				</p>
			</div>

			<div class="tp-mode-list">
				{#each modeOptions as option}
					<button
						class="tp-mode-card {currentMode === option.value ? 'is-active' : ''}"
						onclick={() => setMode(option.value)}
					>
						<div class="tp-mode-meta">{option.value}</div>
						<div class="tp-mode-title">{option.label}</div>
						<div class="tp-mode-subtitle">{option.subtitle}</div>
					</button>
				{/each}
			</div>

			<div class="tp-thread-section">
				<div class="tp-section-head">
					<h2>Threads</h2>
					{#if currentChatId}
						<button class="tp-text-button" onclick={archiveCurrentChat}>Archive</button>
					{/if}
				</div>

				<div class="tp-thread-list">
					{#if ready && chats.length === 0}
						<div class="tp-thread-empty">No conversation yet</div>
					{:else}
						{#each chats as chat}
							<button
								class="tp-thread-item {currentChatId === chat.id ? 'is-active' : ''}"
								onclick={() => selectChat(chat.id)}
							>
								<div class="tp-thread-title">{chat.title || 'TradePilot'}</div>
								<div class="tp-thread-time">
									{chat.last_message_at ? new Date(chat.last_message_at).toLocaleString('th-TH') : 'ยังไม่มีข้อความ'}
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</aside>

		<section class="tp-stage">
			<header class="tp-stage-head">
				<div class="tp-stage-copy">
					<p class="tp-kicker">Focused Mode</p>
					<h2 class="tp-stage-title">{activeModeMeta.label}</h2>
					<p class="tp-stage-subtitle">{activeModeMeta.subtitle}</p>
				</div>

				<div class="tp-stage-actions">
					<div class="tp-status-chip">
						<span class="tp-status-dot"></span>
						{loading ? 'Thinking' : 'Ready'}
					</div>
					<a href={pageHref(currentMode)} class="tp-ghost-button">Permalink</a>
				</div>
			</header>

			<div class="tp-message-wrap" bind:this={messagesContainer}>
				{#if !hasMessages}
					<div class="tp-empty">
						<p class="tp-kicker">Refined Workflow</p>
						<h3 class="tp-empty-title">One calm surface for portfolio review, coaching, and market context.</h3>
						<p class="tp-empty-copy">
							TradePilot stays anchored to the current account, then expands outward only when context is needed.
						</p>

						<div class="tp-starter-grid">
							{#each starterPrompts[currentMode] as starter}
								<button class="tp-starter-card" onclick={() => sendMessage(starter)}>
									{starter}
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<div class="tp-conversation">
						{#each messages as message}
							<div class="tp-message-row">
								<AiChatMessage role={message.role} content={message.content} />
								{#if message.role === 'assistant' && message.citations && message.citations.length > 0}
									<div class="tp-citations">
										{#each message.citations as citation}
											<span class="tp-citation-chip">{citation.label}</span>
										{/each}
									</div>
								{/if}
								{#if message.role === 'assistant' && message.id && !message.id.startsWith('tmp-assistant')}
									<div class="tp-feedback-row">
										<button
											class="tp-feedback-button {feedbackState[message.id] === 'positive' ? 'is-positive' : ''}"
											onclick={() => sendFeedback(message.id, 'positive', message.run_id)}
										>
											Useful
										</button>
										<button
											class="tp-feedback-button {feedbackState[message.id] === 'negative' ? 'is-negative' : ''}"
											onclick={() => sendFeedback(message.id, 'negative', message.run_id)}
										>
											Needs work
										</button>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			{#if error}
				<div class="tp-error">
					{error}
				</div>
			{/if}

			<div class="tp-composer-shell">
				<div class="tp-chip-row">
					{#each starterPrompts[currentMode] as starter}
						<button class="tp-composer-chip" onclick={() => { input = starter; }}>
							{starter}
						</button>
					{/each}
				</div>

				<div class="tp-composer">
					<textarea
						class="tp-input"
						placeholder="Ask about performance, mistakes, journal patterns, XAUUSD context, or build a cleaner plan for today."
						bind:value={input}
						onkeydown={(event) => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault();
								void sendMessage();
							}
						}}
					></textarea>

					<div class="tp-composer-footer">
						<p class="tp-composer-meta">Current mode: {activeModeMeta.label}</p>
						<button class="tp-send" onclick={() => sendMessage()} disabled={loading}>
							{loading ? 'Thinking...' : 'Send'}
						</button>
					</div>
				</div>
			</div>
		</section>
	</div>
</div>

<style>
	.tp-shell {
		position: relative;
		overflow: hidden;
		min-height: calc(100vh - 13rem);
		border: 1px solid color-mix(in srgb, var(--c-border, #262626) 90%, #b59c72 10%);
		border-radius: 2rem;
		background:
			radial-gradient(circle at top left, rgba(181, 156, 114, 0.12), transparent 28rem),
			radial-gradient(circle at bottom right, rgba(118, 106, 80, 0.18), transparent 24rem),
			linear-gradient(180deg, rgba(18, 18, 18, 0.94), rgba(8, 8, 8, 0.98));
	}

	.tp-orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(80px);
		pointer-events: none;
		opacity: 0.45;
	}

	.tp-orb-a {
		top: -5rem;
		left: -4rem;
		width: 14rem;
		height: 14rem;
		background: rgba(184, 150, 103, 0.18);
	}

	.tp-orb-b {
		right: -4rem;
		bottom: 4rem;
		width: 18rem;
		height: 18rem;
		background: rgba(97, 89, 70, 0.16);
	}

	.tp-grid {
		position: relative;
		display: grid;
		gap: 1.25rem;
		padding: 1.25rem;
	}

	.tp-rail,
	.tp-stage {
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(16, 16, 16, 0.76);
		backdrop-filter: blur(14px);
	}

	.tp-rail {
		border-radius: 1.6rem;
		padding: 1.1rem;
	}

	.tp-stage {
		border-radius: 1.8rem;
		padding: 1.2rem;
	}

	.tp-brand,
	.tp-section-head,
	.tp-stage-head,
	.tp-composer-footer {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.9rem;
	}

	.tp-kicker {
		margin: 0;
		font-size: 0.62rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: rgba(214, 196, 162, 0.68);
	}

	.tp-display,
	.tp-stage-title,
	.tp-empty-title {
		font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
		letter-spacing: -0.03em;
	}

	.tp-display {
		margin: 0.35rem 0 0;
		font-size: clamp(1.8rem, 2vw, 2.3rem);
		line-height: 0.95;
		color: rgba(250, 247, 240, 0.96);
	}

	.tp-scope {
		margin-top: 1.1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		padding-top: 1rem;
	}

	.tp-pill,
	.tp-status-chip,
	.tp-composer-chip,
	.tp-citation-chip {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
	}

	.tp-pill {
		border: 1px solid rgba(196, 167, 121, 0.24);
		background: rgba(196, 167, 121, 0.08);
		padding: 0.34rem 0.72rem;
		font-size: 0.69rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(222, 206, 179, 0.82);
	}

	.tp-scope-copy,
	.tp-stage-subtitle,
	.tp-empty-copy {
		margin: 0.6rem 0 0;
		line-height: 1.55;
		color: rgba(170, 170, 170, 0.88);
	}

	.tp-mode-list {
		margin-top: 1.2rem;
		display: grid;
		gap: 0.55rem;
	}

	.tp-mode-card,
	.tp-thread-item,
	.tp-starter-card,
	.tp-ghost-button,
	.tp-text-button,
	.tp-feedback-button,
	.tp-send {
		transition:
			background-color 180ms ease,
			border-color 180ms ease,
			color 180ms ease,
			transform 180ms ease,
			opacity 180ms ease;
	}

	.tp-mode-card {
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 1.2rem;
		padding: 0.9rem 0.95rem;
		background: rgba(255, 255, 255, 0.02);
		text-align: left;
	}

	.tp-mode-card:hover,
	.tp-thread-item:hover,
	.tp-starter-card:hover,
	.tp-composer-chip:hover,
	.tp-ghost-button:hover,
	.tp-feedback-button:hover {
		border-color: rgba(207, 182, 139, 0.28);
		background: rgba(255, 255, 255, 0.045);
	}

	.tp-mode-card.is-active,
	.tp-thread-item.is-active {
		border-color: rgba(201, 170, 120, 0.34);
		background:
			linear-gradient(180deg, rgba(201, 170, 120, 0.1), rgba(255, 255, 255, 0.02));
	}

	.tp-mode-meta {
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(205, 188, 161, 0.54);
	}

	.tp-mode-title,
	.tp-thread-title {
		margin-top: 0.35rem;
		font-size: 0.92rem;
		font-weight: 600;
		color: rgba(250, 247, 240, 0.94);
	}

	.tp-mode-subtitle,
	.tp-thread-time {
		margin-top: 0.28rem;
		font-size: 0.76rem;
		line-height: 1.45;
		color: rgba(148, 148, 148, 0.82);
	}

	.tp-thread-section {
		margin-top: 1.35rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		padding-top: 1rem;
	}

	.tp-section-head h2 {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgba(179, 179, 179, 0.72);
	}

	.tp-thread-list {
		margin-top: 0.8rem;
		display: grid;
		gap: 0.5rem;
	}

	.tp-thread-item,
	.tp-starter-card {
		border: 1px solid rgba(255, 255, 255, 0.07);
		background: rgba(255, 255, 255, 0.015);
		text-align: left;
	}

	.tp-thread-item {
		border-radius: 1rem;
		padding: 0.8rem 0.88rem;
	}

	.tp-thread-empty {
		border: 1px dashed rgba(255, 255, 255, 0.08);
		border-radius: 1rem;
		padding: 1rem;
		font-size: 0.84rem;
		text-align: center;
		color: rgba(142, 142, 142, 0.8);
	}

	.tp-stage-head {
		border-bottom: 1px solid rgba(255, 255, 255, 0.07);
		padding-bottom: 1rem;
	}

	.tp-stage-title {
		margin: 0.4rem 0 0;
		font-size: clamp(1.55rem, 2.2vw, 2.3rem);
		color: rgba(248, 246, 241, 0.97);
	}

	.tp-stage-actions {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.tp-status-chip,
	.tp-ghost-button {
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.025);
	}

	.tp-status-chip {
		padding: 0.46rem 0.78rem;
		font-size: 0.73rem;
		color: rgba(232, 226, 214, 0.86);
	}

	.tp-status-dot {
		width: 0.45rem;
		height: 0.45rem;
		margin-right: 0.5rem;
		border-radius: 999px;
		background: rgba(201, 170, 120, 0.9);
		box-shadow: 0 0 0.8rem rgba(201, 170, 120, 0.55);
	}

	.tp-ghost-button,
	.tp-text-button {
		padding: 0.55rem 0.82rem;
		font-size: 0.74rem;
		color: rgba(191, 191, 191, 0.84);
		border-radius: 999px;
	}

	.tp-text-button {
		border: none;
		background: transparent;
		padding-right: 0;
	}

	.tp-message-wrap {
		min-height: 54vh;
		max-height: 60vh;
		overflow-y: auto;
		padding: 1.2rem 0.15rem 0.2rem;
	}

	.tp-empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		min-height: 50vh;
		padding: 0.5rem 0.35rem;
	}

	.tp-empty-title {
		max-width: 17ch;
		margin: 0.7rem 0 0;
		font-size: clamp(2rem, 4vw, 3.6rem);
		line-height: 0.96;
		color: rgba(248, 245, 239, 0.97);
	}

	.tp-empty-copy {
		max-width: 42rem;
		margin-top: 1rem;
		font-size: 0.98rem;
	}

	.tp-starter-grid {
		margin-top: 1.8rem;
		display: grid;
		width: min(100%, 54rem);
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.tp-starter-card {
		border-radius: 1.35rem;
		padding: 1rem 1.1rem;
		font-size: 0.92rem;
		line-height: 1.45;
		color: rgba(221, 221, 221, 0.92);
	}

	.tp-conversation {
		display: grid;
		gap: 1rem;
		padding: 0 0.35rem 0.25rem 0;
	}

	.tp-message-row {
		display: grid;
		gap: 0.45rem;
	}

	.tp-citations,
	.tp-chip-row,
	.tp-feedback-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.tp-citations,
	.tp-feedback-row {
		padding-left: 0.8rem;
	}

	.tp-citation-chip {
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.025);
		padding: 0.32rem 0.65rem;
		font-size: 0.68rem;
		color: rgba(180, 180, 180, 0.88);
	}

	.tp-feedback-button {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		padding: 0.36rem 0.72rem;
		font-size: 0.69rem;
		color: rgba(165, 165, 165, 0.88);
		background: transparent;
	}

	.tp-feedback-button.is-positive {
		border-color: rgba(92, 182, 123, 0.35);
		color: rgba(163, 225, 182, 0.95);
	}

	.tp-feedback-button.is-negative {
		border-color: rgba(202, 92, 92, 0.34);
		color: rgba(241, 174, 174, 0.95);
	}

	.tp-error {
		margin-top: 0.95rem;
		border: 1px solid rgba(195, 81, 81, 0.24);
		border-radius: 1rem;
		background: rgba(112, 30, 30, 0.18);
		padding: 0.85rem 1rem;
		font-size: 0.85rem;
		color: rgba(255, 195, 195, 0.94);
	}

	.tp-composer-shell {
		margin-top: 1rem;
		border-top: 1px solid rgba(255, 255, 255, 0.07);
		padding-top: 1rem;
	}

	.tp-chip-row {
		margin-bottom: 0.8rem;
	}

	.tp-composer-chip {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.025);
		padding: 0.42rem 0.78rem;
		font-size: 0.72rem;
		color: rgba(177, 177, 177, 0.88);
	}

	.tp-composer {
		border: 1px solid rgba(199, 173, 127, 0.16);
		border-radius: 1.6rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.015));
		padding: 0.95rem;
	}

	.tp-input {
		min-height: 6.75rem;
		width: 100%;
		resize: none;
		border: none;
		background: transparent;
		padding: 0.1rem 0.1rem 0 0.1rem;
		font-size: 0.97rem;
		line-height: 1.55;
		color: rgba(247, 247, 244, 0.96);
		outline: none;
	}

	.tp-input::placeholder {
		color: rgba(131, 131, 131, 0.78);
	}

	.tp-composer-meta {
		margin: 0;
		font-size: 0.72rem;
		color: rgba(159, 159, 159, 0.82);
	}

	.tp-send {
		border: 1px solid rgba(201, 170, 120, 0.3);
		border-radius: 999px;
		background: rgba(206, 177, 130, 0.9);
		padding: 0.72rem 1.2rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: #14120f;
	}

	.tp-send:disabled {
		opacity: 0.55;
	}

	.tp-send:not(:disabled):hover {
		transform: translateY(-1px);
		background: rgba(221, 192, 144, 0.96);
	}

	@media (min-width: 1080px) {
		.tp-grid {
			grid-template-columns: 18.5rem minmax(0, 1fr);
		}

		.tp-rail {
			position: sticky;
			top: 1rem;
			height: calc(100vh - 10.5rem);
			overflow: auto;
		}
	}

	@media (max-width: 1079px) {
		.tp-message-wrap {
			max-height: none;
			min-height: 34rem;
		}
	}

	@media (max-width: 720px) {
		.tp-shell {
			border-radius: 1.45rem;
		}

		.tp-grid {
			padding: 0.85rem;
			gap: 0.85rem;
		}

		.tp-rail,
		.tp-stage {
			border-radius: 1.2rem;
			padding: 0.95rem;
		}

		.tp-brand,
		.tp-stage-head,
		.tp-composer-footer {
			flex-direction: column;
			align-items: stretch;
		}

		.tp-stage-actions {
			justify-content: space-between;
		}

		.tp-empty {
			min-height: 30rem;
		}

		.tp-empty-title {
			max-width: 12ch;
			font-size: 2.3rem;
		}

		.tp-starter-grid {
			grid-template-columns: 1fr;
		}

		.tp-composer {
			border-radius: 1.2rem;
		}
	}
</style>
