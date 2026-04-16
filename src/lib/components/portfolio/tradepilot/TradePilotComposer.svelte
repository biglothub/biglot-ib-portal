<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		input: string;
		busy: boolean;
		disabled: boolean;
		prompts: string[];
		streamSummary: string | null;
		onInput?: (value: string) => void;
		onSend?: () => void;
		onSetPrompt?: (prompt: string) => void;
	}

	let { input, busy, disabled, prompts, streamSummary, onInput, onSend, onSetPrompt }: Props = $props();

	let textarea = $state<HTMLTextAreaElement | null>(null);

	async function resizeTextarea(): Promise<void> {
		await tick();
		if (!textarea) return;
		textarea.style.height = '0px';
		textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
	}

	$effect(() => {
		void input;
		void resizeTextarea();
	});
</script>

<div class="tp-composer">
	<div class="tp-composer__prompt-row">
		{#each prompts as prompt}
			<button class="tp-composer__chip" type="button" onclick={() => onSetPrompt?.(prompt)}>
				{prompt}
			</button>
		{/each}
	</div>

	<div class="tp-composer__panel">
		<textarea
			bind:this={textarea}
			class="tp-composer__textarea"
			placeholder="Ask about performance, mistakes, journal patterns, or today's market context."
			value={input}
			oninput={(event) => onInput?.((event.currentTarget as HTMLTextAreaElement).value)}
			onkeydown={(event) => {
				if (event.key === 'Enter' && !event.shiftKey) {
					event.preventDefault();
					onSend?.();
				}
			}}
		></textarea>

		<div class="tp-composer__footer">
			<div class="tp-composer__status">
				<span>Shift + Enter for newline</span>
				{#if busy && streamSummary}
					<span class="tp-composer__status-pill">{streamSummary}</span>
				{/if}
			</div>

			<button class="tp-composer__send" type="button" onclick={() => onSend?.()} disabled={disabled}>
				{busy ? 'Thinking…' : 'Send'}
			</button>
		</div>
	</div>
</div>

<style>
	.tp-composer {
		display: grid;
		gap: 0.8rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		background: linear-gradient(180deg, rgba(8, 8, 8, 0), rgba(8, 8, 8, 0.88) 18%, rgba(8, 8, 8, 0.98));
	}

	.tp-composer__prompt-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.tp-composer__chip,
	.tp-composer__send {
		transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
	}

	.tp-composer__chip {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.03);
		padding: 0.4rem 0.72rem;
		font-size: 0.74rem;
		color: rgba(212, 212, 216, 0.88);
	}

	.tp-composer__chip:hover {
		border-color: rgba(216, 184, 108, 0.24);
		background: rgba(255, 255, 255, 0.06);
	}

	.tp-composer__panel {
		display: grid;
		gap: 0.85rem;
		padding: 0.9rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1.1rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.015)),
			radial-gradient(circle at top left, rgba(201, 168, 76, 0.1), transparent 52%);
	}

	.tp-composer__textarea {
		width: 100%;
		min-height: 6.25rem;
		max-height: 13.75rem;
		resize: none;
		border: 0;
		background: transparent;
		color: rgba(245, 245, 244, 0.96);
		font-size: 0.96rem;
		line-height: 1.65;
		outline: none;
	}

	.tp-composer__textarea::placeholder {
		color: rgba(161, 161, 170, 0.84);
	}

	.tp-composer__footer,
	.tp-composer__status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.tp-composer__status {
		flex-wrap: wrap;
		font-size: 0.76rem;
		color: rgba(161, 161, 170, 0.86);
	}

	.tp-composer__status-pill {
		display: inline-flex;
		align-items: center;
		border: 1px solid rgba(216, 184, 108, 0.22);
		border-radius: 999px;
		background: rgba(216, 184, 108, 0.1);
		padding: 0.35rem 0.68rem;
		color: rgba(255, 243, 210, 0.92);
	}

	.tp-composer__send {
		min-width: 6.2rem;
		border: 1px solid rgba(216, 184, 108, 0.22);
		border-radius: 0.95rem;
		background: rgba(216, 184, 108, 0.12);
		padding: 0.74rem 1rem;
		font-size: 0.84rem;
		font-weight: 600;
		color: rgba(255, 248, 230, 0.96);
	}

	.tp-composer__send:hover:not(:disabled) {
		transform: translateY(-1px);
		background: rgba(216, 184, 108, 0.18);
	}

	.tp-composer__send:disabled {
		opacity: 0.45;
	}

	@media (max-width: 720px) {
		.tp-composer__footer {
			align-items: stretch;
			flex-direction: column;
		}

		.tp-composer__send {
			width: 100%;
		}
	}
</style>

