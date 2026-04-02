<script lang="ts">
	import { focusTrap } from '$lib/actions/focusTrap';
	import { fly, fade } from 'svelte/transition';
	import AiChatMessage from './AiChatMessage.svelte';
	import {
		getAiChatMessages,
		addAiChatMessage,
		removeLastAiChatMessage,
		clearAiChat
	} from '$lib/stores/aiChat.svelte';

	let {
		open,
		onclose,
		accountId,
		clientName
	}: {
		open: boolean;
		onclose: () => void;
		accountId: string;
		clientName: string;
	} = $props();

	let messages = $derived(getAiChatMessages());
	let input = $state('');
	let loading = $state(false);
	let error = $state('');
	let messagesContainer = $state<HTMLDivElement>();

	const starters = [
		'วิเคราะห์ผลเทรดสัปดาห์นี้',
		'จุดอ่อนในการเทรดของฉันคืออะไร?',
		'เปรียบเทียบ session ไหนที่ฉันเทรดได้ดีที่สุด',
		'สรุปพอร์ตของฉันวันนี้'
	];

	function scrollToBottom() {
		const el = messagesContainer;
		if (el) {
			requestAnimationFrame(() => {
				el.scrollTop = el.scrollHeight;
			});
		}
	}

	async function sendMessage(text?: string) {
		const content = (text || input).trim();
		if (!content || loading) return;

		input = '';
		error = '';
		addAiChatMessage({ role: 'user', content });
		addAiChatMessage({ role: 'assistant', content: '' });
		loading = true;
		scrollToBottom();

		try {
			const res = await fetch('/api/portfolio/ai-chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					messages: messages.slice(0, -1) // exclude the empty assistant message
				})
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				if (res.status === 429) {
					error = 'คุณส่งข้อความเร็วเกินไป กรุณารอสักครู่';
				} else {
					error = data.message || 'เกิดข้อผิดพลาด';
				}
				removeLastAiChatMessage(); // remove empty assistant message
				loading = false;
				return;
			}

			const reader = res.body?.getReader();
			if (!reader) {
				error = 'ไม่สามารถเชื่อมต่อได้';
				removeLastAiChatMessage();
				loading = false;
				return;
			}

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
					try {
						const chunk = JSON.parse(line);
						if (chunk.type === 'text_delta') {
							messages[messages.length - 1].content += chunk.text;
							scrollToBottom();
						} else if (chunk.type === 'error') {
							error = chunk.message || 'AI error';
						}
					} catch {
						// skip malformed lines
					}
				}
			}

			// Remove assistant message if empty
			if (messages[messages.length - 1]?.content === '') {
				removeLastAiChatMessage();
			}
		} catch {
			error = 'ไม่สามารถเชื่อมต่อได้ ลองอีกครั้ง';
			if (messages[messages.length - 1]?.content === '') {
				removeLastAiChatMessage();
			}
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function handlePanelKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		}
	}
</script>

{#if open}
	<!-- Backdrop -->
	<button
		type="button"
		class="fixed inset-0 bg-black/40 z-50 cursor-default"
		transition:fade={{ duration: 200 }}
		onmousedown={onclose}
		aria-hidden="true"
		tabindex="-1"
		aria-label="ปิด AI ผู้ช่วย"
	></button>

	<!-- Panel -->
	<div
		use:focusTrap={{ enabled: open, initialFocus: 'textarea' }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="ai-chat-title"
		tabindex="-1"
		class="fixed right-0 top-0 h-full w-full sm:w-96 bg-dark-surface border-l border-dark-border z-50 flex flex-col focus:outline-none"
		transition:fly={{ x: 384, duration: 300 }}
		onkeydown={handlePanelKeydown}
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-dark-border">
			<div class="flex items-center gap-2">
				<div class="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center">
					<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round"
							d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
					</svg>
				</div>
				<div>
					<h3 id="ai-chat-title" class="text-sm font-semibold text-white">AI ผู้ช่วยเทรด</h3>
					<p class="text-xs text-gray-400">วิเคราะห์ข้อมูลการเทรดของคุณ</p>
				</div>
			</div>
			<div class="flex items-center gap-1">
				{#if messages.length > 0}
					<button
						onclick={clearAiChat}
						class="p-1.5 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors cursor-pointer"
						aria-label="เริ่มแชทใหม่"
						title="เริ่มแชทใหม่"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round"
								d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
						</svg>
					</button>
				{/if}
				<button
					onclick={onclose}
					class="p-1.5 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-white transition-colors cursor-pointer"
					aria-label="ปิด"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Messages -->
		<div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite" aria-label="ประวัติการสนทนา">
			{#if messages.length === 0}
				<!-- Welcome -->
				<div class="flex flex-col items-center justify-center h-full text-center px-4">
					<div class="w-16 h-16 rounded-full bg-brand-600/10 flex items-center justify-center mb-4">
						<svg class="w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round"
								d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
						</svg>
					</div>
					<h4 class="text-white font-medium mb-1">สวัสดีครับ!</h4>
					<p class="text-sm text-gray-400 mb-6">ผมเป็นผู้ช่วย AI พร้อมวิเคราะห์ข้อมูลการเทรดของคุณ</p>

					<div class="grid grid-cols-1 gap-2 w-full">
						{#each starters as starter}
							<button
								onclick={() => sendMessage(starter)}
								class="text-left text-sm px-3 py-2.5 rounded-xl border border-dark-border
									hover:border-brand-600/50 hover:bg-dark-hover text-gray-400 hover:text-gray-200
									transition-colors cursor-pointer"
							>
								{starter}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				{#each messages as msg, i}
					{#if msg.content || (msg.role === 'assistant' && loading && i === messages.length - 1)}
						<AiChatMessage role={msg.role} content={msg.content} />
					{/if}
				{/each}

				<!-- Typing indicator -->
				{#if loading && messages[messages.length - 1]?.content === ''}
					<div class="flex justify-start">
						<div class="bg-dark-hover rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
							<span class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
							<span class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
							<span class="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Error -->
		{#if error}
			<div class="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
				<p class="text-xs text-red-400 text-center">{error}</p>
			</div>
		{/if}

		<!-- Input -->
		<div class="px-4 py-3 border-t border-dark-border">
			<div class="flex gap-2">
				<textarea
					bind:value={input}
					onkeydown={handleKeydown}
					placeholder="ถามเกี่ยวกับการเทรดของคุณ..."
					rows="1"
					disabled={loading}
					class="input flex-1 resize-none text-sm !py-2.5 !rounded-xl"
				></textarea>
				<button
					onclick={() => sendMessage()}
					disabled={loading || !input.trim()}
					class="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white
						disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
					aria-label="ส่งข้อความ"
				>
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round"
							d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
					</svg>
				</button>
			</div>
		</div>
	</div>
{/if}
