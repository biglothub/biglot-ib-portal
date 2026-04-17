<script lang="ts">
	import { tick } from 'svelte';
	import type { BigLotAiMode } from '$lib/types';
	import type { TradePilotModeOption } from '$lib/tradepilot';

	interface Props {
		input: string;
		busy: boolean;
		disabled: boolean;
		prompts: string[];
		streamSummary: string | null;
		currentMode: BigLotAiMode;
		modeOptions: TradePilotModeOption[];
		onInput?: (value: string) => void;
		onSend?: () => void;
		onSetPrompt?: (prompt: string) => void;
		onModeChange?: (mode: BigLotAiMode) => void;
	}

	let { input, busy, disabled, prompts, streamSummary, currentMode, modeOptions, onInput, onSend, onSetPrompt, onModeChange }: Props = $props();

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
	<div class="tp-composer__mode-strip">
		{#each modeOptions as option}
			<button
				type="button"
				class="tp-composer__mode-pill {currentMode === option.value ? 'is-active' : ''}"
				onclick={() => onModeChange?.(option.value)}
			>
				{option.eyebrow}
			</button>
		{/each}
	</div>

	<div class="tp-composer__prompt-row">
		{#each prompts as prompt}
			<button class="tp-composer__chip" type="button" onclick={() => onSetPrompt?.(prompt)}>
				{prompt}
			</button>
		{/each}
	</div>

	{#if busy && streamSummary}
		<div class="tp-composer__stream-status">
			<span class="tp-composer__status-pill">{streamSummary}</span>
		</div>
	{/if}

	<div class="tp-composer__pill">
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

		<button
			class="tp-composer__send"
			class:is-active={!disabled}
			type="button"
			onclick={() => onSend?.()}
			{disabled}
			aria-label={busy ? 'Thinking…' : 'Send'}
		>
			{#if busy}
				<span class="tp-composer__send-spinner">⋯</span>
			{:else}
				↑
			{/if}
		</button>
	</div>

	<p class="tp-composer__hint">Shift + Enter for newline</p>
</div>

<style>
	.tp-composer {
		display: grid;
		gap: 0.65rem;
		padding-top: 0.75rem;
		padding-bottom: 0.4rem;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}

	.tp-composer__mode-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		padding: 0 0.1rem;
	}

	.tp-composer__mode-pill {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		background: transparent;
		padding: 0.3rem 0.65rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(161, 161, 170, 0.7);
		transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
	}

	.tp-composer__mode-pill:hover {
		background: rgba(255, 255, 255, 0.04);
		color: rgba(212, 212, 216, 0.9);
	}

	.tp-composer__mode-pill.is-active {
		border-color: rgba(216, 184, 108, 0.35);
		background: rgba(216, 184, 108, 0.14);
		color: rgba(255, 243, 210, 0.95);
	}

	.tp-composer__prompt-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.tp-composer__chip {
		border: 1px solid rgba(255, 255, 255, 0.07);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.02);
		padding: 0.38rem 0.68rem;
		font-size: 0.72rem;
		color: rgba(212, 212, 216, 0.5);
		letter-spacing: 0.02em;
		transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
	}

	.tp-composer__chip:hover {
		border-color: rgba(216, 184, 108, 0.2);
		background: rgba(255, 255, 255, 0.05);
		color: rgba(212, 212, 216, 0.85);
	}

	.tp-composer__stream-status {
		display: flex;
		padding: 0 0.1rem;
	}

	.tp-composer__status-pill {
		display: inline-flex;
		align-items: center;
		border: 1px solid rgba(216, 184, 108, 0.22);
		border-radius: 999px;
		background: rgba(216, 184, 108, 0.1);
		padding: 0.3rem 0.62rem;
		font-size: 0.72rem;
		color: rgba(255, 243, 210, 0.92);
	}

	.tp-composer__pill {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		padding: 0.65rem 0.65rem 0.65rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 2rem;
		background: rgba(24, 24, 27, 0.72);
		backdrop-filter: blur(10px);
		transition: border-color 160ms ease;
	}

	.tp-composer__pill:focus-within {
		border-color: rgba(216, 184, 108, 0.2);
	}

	.tp-composer__textarea {
		flex: 1 1 auto;
		min-height: 2.75rem;
		max-height: 13.75rem;
		resize: none;
		border: 0;
		background: transparent;
		color: rgba(245, 245, 244, 0.96);
		font-size: 0.96rem;
		line-height: 1.65;
		outline: none;
		padding: 0;
		align-self: center;
	}

	.tp-composer__textarea::placeholder {
		color: rgba(161, 161, 170, 0.7);
	}

	.tp-composer__send {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 999px;
		border: 0;
		font-size: 1rem;
		font-weight: 700;
		transition: background-color 140ms ease, opacity 140ms ease, transform 140ms ease;
	}

	.tp-composer__send.is-active {
		background: rgba(216, 184, 108, 0.9);
		color: #1a1200;
	}

	.tp-composer__send.is-active:hover {
		transform: translateY(-1px);
		background: rgba(216, 184, 108, 1);
	}

	.tp-composer__send:not(.is-active) {
		background: rgba(255, 255, 255, 0.05);
		color: rgba(161, 161, 170, 0.45);
		cursor: not-allowed;
	}

	.tp-composer__send-spinner {
		font-size: 1.1rem;
		letter-spacing: 0.05em;
	}

	.tp-composer__hint {
		margin: 0;
		font-size: 0.68rem;
		color: rgba(161, 161, 170, 0.35);
		text-align: center;
	}
</style>
