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
	const canFeedback = $derived(
		message.role === 'assistant' &&
		!!message.id &&
		!message.id.startsWith('tmp-assistant') &&
		!!message.content
	);
</script>

<article class="tp-row">
	<AiChatMessage role={message.role} content={displayContent} />

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

				<div class="tp-row__meta">
					<div class="tp-row__meta-group">
						<button class="tp-row__meta-button" type="button" onclick={() => onCopy?.(message.id, message.content)}>
							{copiedMessageId === message.id ? 'Copied' : 'Copy'}
						</button>

						{#if message.status === 'streaming'}
							<span class="tp-row__status">Streaming</span>
						{/if}
					</div>

					{#if canFeedback}
						<div class="tp-row__meta-group">
							<button
								class="tp-row__meta-button {feedbackState[message.id] === 'positive' ? 'is-active' : ''}"
								type="button"
								onclick={() => onFeedback?.(message.id, 'positive', message.run_id)}
							>
								Useful
							</button>
							<button
								class="tp-row__meta-button {feedbackState[message.id] === 'negative' ? 'is-active' : ''}"
								type="button"
								onclick={() => onFeedback?.(message.id, 'negative', message.run_id)}
							>
								Needs work
							</button>
						</div>
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
		padding-left: 2.95rem;
	}

	.tp-row__footer-main {
		display: grid;
		gap: 0.7rem;
		padding: 0.75rem 0.85rem 0.2rem;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
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

	.tp-row__citation-list,
	.tp-row__meta,
	.tp-row__meta-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tp-row__meta {
		align-items: center;
		justify-content: space-between;
	}

	.tp-row__meta-button,
	.tp-row__citation,
	.tp-row__status {
		display: inline-flex;
		align-items: center;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		padding: 0.36rem 0.7rem;
		font-size: 0.72rem;
		line-height: 1;
	}

	.tp-row__meta-button {
		background: rgba(255, 255, 255, 0.015);
		color: rgba(212, 212, 216, 0.9);
		transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
	}

	.tp-row__meta-button:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.tp-row__meta-button.is-active {
		border-color: rgba(216, 184, 108, 0.28);
		background: rgba(216, 184, 108, 0.1);
		color: rgba(255, 243, 210, 0.95);
	}

	.tp-row__citation {
		background: rgba(255, 255, 255, 0.035);
		color: rgba(229, 229, 232, 0.9);
	}

	.tp-row__status {
		background: rgba(216, 184, 108, 0.1);
		color: rgba(255, 243, 210, 0.9);
	}

	@media (max-width: 720px) {
		.tp-row__footer {
			padding-left: 0;
		}

		.tp-row__footer-main,
		.tp-row__meta {
			padding-left: 0;
			padding-right: 0;
		}

		.tp-row__meta {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
