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
			? 'กำลังวิเคราะห์บริบทของ account นี้…'
			: 'ยังไม่มีคำตอบ')
	);
	const isStreaming = $derived(message.status === 'streaming');
	const canFeedback = $derived(
		message.role === 'assistant' &&
		!!message.id &&
		!message.id.startsWith('tmp-assistant') &&
		!!message.content
	);
</script>

<article class="tp-row">
	<AiChatMessage role={message.role} content={displayContent} {isStreaming} />

	{#if message.role === 'assistant'}
		<div class="tp-row__footer">
			<div class="tp-row__footer-main">
				{#if message.citations && message.citations.length > 0}
					<div class="tp-row__citations">
						<div class="tp-row__section-label">Sources</div>
						<div class="tp-row__citation-list">
							{#each message.citations as citation}
								<span class="tp-row__citation" title={citation.source}>{citation.label}</span>
							{/each}
						</div>
					</div>
				{/if}

				<div class="tp-row__actions">
					<button
						class="tp-row__action"
						type="button"
						title={copiedMessageId === message.id ? 'Copied!' : 'Copy'}
						onclick={() => onCopy?.(message.id, message.content)}
					>
						{#if copiedMessageId === message.id}
							<span class="tp-row__action-icon is-green">✓</span>
						{:else}
							<span class="tp-row__action-icon">⧉</span>
						{/if}
					</button>

					{#if canFeedback}
						<span class="tp-row__action-sep" aria-hidden="true"></span>
						<button
							class="tp-row__action {feedbackState[message.id] === 'positive' ? 'is-active' : ''}"
							type="button"
							title="Useful"
							onclick={() => onFeedback?.(message.id, 'positive', message.run_id)}
						>
							<span class="tp-row__action-icon">↑</span>
						</button>
						<button
							class="tp-row__action {feedbackState[message.id] === 'negative' ? 'is-active' : ''}"
							type="button"
							title="Needs work"
							onclick={() => onFeedback?.(message.id, 'negative', message.run_id)}
						>
							<span class="tp-row__action-icon">↓</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</article>

<style>
	.tp-row {
		display: grid;
		gap: 0.75rem;
	}

	.tp-row__footer {
		padding-left: 2.5rem;
	}

	.tp-row__footer-main {
		display: grid;
		gap: 0.6rem;
		padding: 0.6rem 0.5rem 0.15rem;
	}

	.tp-row__citations {
		display: grid;
		gap: 0.45rem;
	}

	.tp-row__section-label {
		font-size: 0.66rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(216, 184, 108, 0.82);
	}

	.tp-row__citation-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tp-row__citation {
		display: inline-flex;
		align-items: center;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		padding: 0.3rem 0.62rem;
		font-size: 0.72rem;
		background: rgba(255, 255, 255, 0.035);
		color: rgba(229, 229, 232, 0.9);
	}

	.tp-row__actions {
		display: flex;
		align-items: center;
		gap: 0.15rem;
	}

	.tp-row__action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem;
		border-radius: 0.375rem;
		border: 0;
		background: transparent;
		color: rgba(161, 161, 170, 0.65);
		transition: background-color 140ms ease, color 140ms ease;
	}

	.tp-row__action:hover {
		background: rgba(255, 255, 255, 0.05);
		color: rgba(245, 245, 244, 0.9);
	}

	.tp-row__action.is-active {
		color: rgba(216, 184, 108, 0.92);
	}

	.tp-row__action-icon {
		font-size: 0.88rem;
		line-height: 1;
	}

	.tp-row__action-icon.is-green {
		color: rgba(74, 222, 128, 0.9);
	}

	.tp-row__action-sep {
		display: inline-block;
		width: 1px;
		height: 0.85rem;
		background: rgba(255, 255, 255, 0.1);
		margin: 0 0.15rem;
	}

	@media (max-width: 720px) {
		.tp-row__footer {
			padding-left: 0;
		}

		.tp-row__footer-main {
			padding-left: 0;
			padding-right: 0;
		}
	}
</style>
