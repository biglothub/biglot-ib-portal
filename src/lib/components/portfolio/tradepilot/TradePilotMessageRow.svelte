<script lang="ts">
	import AiChatMessage from '$lib/components/portfolio/AiChatMessage.svelte';
	import type { BigLotAiMessage } from '$lib/types';

	interface Props {
		message: BigLotAiMessage;
		copiedMessageId: string | null;
		feedbackState: Record<string, 'positive' | 'negative'>;
		onCopy?: (messageId: string, content: string) => void;
		onFeedback?: (messageId: string, feedback: 'positive' | 'negative', runId: string | null) => void;
	}

	let { message, copiedMessageId, feedbackState, onCopy, onFeedback }: Props = $props();

	const displayContent = $derived(
		message.content || (message.role === 'assistant' && message.status === 'streaming'
			? 'Reading account context…'
			: 'No response yet.')
	);
	const isStreaming = $derived(message.status === 'streaming');
	const canFeedback = $derived(
		message.role === 'assistant' &&
		!!message.id &&
		!message.id.startsWith('tmp-assistant') &&
		!!message.content
	);
</script>

<article class="tp-row {message.role === 'user' ? 'is-user' : 'is-assistant'}">
	<AiChatMessage role={message.role} content={displayContent} {isStreaming} />

	{#if message.role === 'assistant' && !isStreaming}
		<div class="tp-row__footer">
			{#if message.citations && message.citations.length > 0}
				<div class="tp-row__citations">
					{#each message.citations as citation}
						<span class="tp-row__citation" title={citation.source}>{citation.label}</span>
					{/each}
				</div>
			{/if}

			<div class="tp-row__actions">
				<button
					class="tp-row__action"
					type="button"
					title={copiedMessageId === message.id ? 'Copied' : 'Copy'}
					onclick={() => onCopy?.(message.id, message.content)}
				>
					{#if copiedMessageId === message.id}
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="is-green"><path d="M2.5 6.5l2.5 2.5 5.5-5.5"/></svg>
					{:else}
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><path d="M2 8.5V2.5C2 2.22 2.22 2 2.5 2h6"/></svg>
					{/if}
				</button>

				{#if canFeedback}
					<button
						class="tp-row__action {feedbackState[message.id] === 'positive' ? 'is-active' : ''}"
						type="button"
						title="Useful"
						onclick={() => onFeedback?.(message.id, 'positive', message.run_id)}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5V11h6.2c.5 0 1-.36 1.1-.85L11 7.2V6c0-.55-.45-1-1-1H7.5l.55-2.4c.05-.3-.1-.6-.4-.7l-.4-.15-2.75 4.25"/><path d="M3 6.5H1.5V11H3"/></svg>
					</button>
					<button
						class="tp-row__action {feedbackState[message.id] === 'negative' ? 'is-active' : ''}"
						type="button"
						title="Needs work"
						onclick={() => onFeedback?.(message.id, 'negative', message.run_id)}
					>
						<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5V2h6.2c.5 0 1 .36 1.1.85L11 5.8V7c0 .55-.45 1-1 1H7.5l.55 2.4c.05.3-.1.6-.4.7l-.4.15-2.75-4.25"/><path d="M3 6.5H1.5V2H3"/></svg>
					</button>
				{/if}
			</div>
		</div>
	{/if}
</article>

<style>
	.tp-row {
		display: grid;
		gap: 0.5rem;
		animation: tp-row-in 280ms cubic-bezier(0.32, 0.72, 0.24, 1);
	}

	@keyframes tp-row-in {
		from { opacity: 0; transform: translateY(6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.tp-row__footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.85rem;
		padding-top: 0.15rem;
		min-height: 1.5rem;
	}

	.tp-row__citations {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		flex: 1 1 auto;
	}

	.tp-row__citation {
		display: inline-flex;
		align-items: center;
		padding: 0.18rem 0.5rem;
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.005em;
		color: rgba(180, 180, 175, 0.85);
		background: rgba(255, 255, 255, 0.035);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 0.3rem;
		font-variant-numeric: tabular-nums;
	}

	.tp-row__actions {
		display: flex;
		align-items: center;
		gap: 1px;
		margin-left: auto;
		opacity: 0;
		transition: opacity 160ms ease;
	}

	.tp-row:hover .tp-row__actions,
	.tp-row__actions:focus-within {
		opacity: 1;
	}

	.tp-row__action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 0.35rem;
		border: 0;
		background: transparent;
		color: rgba(140, 140, 138, 0.7);
		cursor: pointer;
		transition: background-color 140ms ease, color 140ms ease;
	}

	.tp-row__action:hover {
		background: rgba(255, 255, 255, 0.05);
		color: rgba(237, 237, 234, 0.95);
	}

	.tp-row__action.is-active {
		color: var(--tp-accent, #c9a86c);
	}

	.tp-row__action .is-green {
		color: rgba(110, 200, 130, 0.95);
	}

	@media (hover: none) {
		.tp-row__actions {
			opacity: 1;
		}
	}
</style>
