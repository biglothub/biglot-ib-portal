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

	let { input, busy, disabled, prompts: _prompts, streamSummary, currentMode, modeOptions, onInput, onSend, onSetPrompt: _onSetPrompt, onModeChange }: Props = $props();

	let textarea = $state<HTMLTextAreaElement | null>(null);
	let modeMenuOpen = $state(false);

	const activeMode = $derived(modeOptions.find((option) => option.value === currentMode) ?? modeOptions[0]);

	async function resizeTextarea(): Promise<void> {
		await tick();
		if (!textarea) return;
		textarea.style.height = '0px';
		textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
	}

	function selectMode(mode: BigLotAiMode): void {
		modeMenuOpen = false;
		onModeChange?.(mode);
	}

	$effect(() => {
		void input;
		void resizeTextarea();
	});
</script>

<div class="tp-composer">
	{#if busy && streamSummary}
		<div class="tp-composer__status">
			<span class="tp-composer__status-shimmer"></span>
			<span class="tp-composer__status-text">{streamSummary}</span>
		</div>
	{/if}

	<div class="tp-composer__field" class:is-busy={busy}>
		<textarea
			bind:this={textarea}
			class="tp-composer__textarea"
			placeholder="Ask TradePilot anything about this account…"
			value={input}
			oninput={(event) => onInput?.((event.currentTarget as HTMLTextAreaElement).value)}
			onkeydown={(event) => {
				if (event.key === 'Enter' && !event.shiftKey) {
					event.preventDefault();
					onSend?.();
				}
			}}
		></textarea>

		<div class="tp-composer__bar">
			<div class="tp-composer__mode" class:is-open={modeMenuOpen}>
				<button
					class="tp-composer__mode-trigger"
					type="button"
					onclick={() => { modeMenuOpen = !modeMenuOpen; }}
					aria-haspopup="listbox"
					aria-expanded={modeMenuOpen}
				>
					<span class="tp-composer__mode-dot" aria-hidden="true"></span>
					<span class="tp-composer__mode-label">{activeMode.label}</span>
					<svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
						<path d="M2 3.5l2.5 2.5L7 3.5"/>
					</svg>
				</button>

				{#if modeMenuOpen}
					<div class="tp-composer__mode-menu" role="listbox">
						{#each modeOptions as option}
							<button
								class="tp-composer__mode-option {currentMode === option.value ? 'is-active' : ''}"
								type="button"
								role="option"
								aria-selected={currentMode === option.value}
								onclick={() => selectMode(option.value)}
							>
								<span class="tp-composer__mode-option-name">{option.label}</span>
								<span class="tp-composer__mode-option-eyebrow">{option.eyebrow}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="tp-composer__bar-right">
				<span class="tp-composer__hint">⏎ to send · ⇧⏎ for newline</span>
				<button
					class="tp-composer__send"
					class:is-active={!disabled}
					type="button"
					onclick={() => onSend?.()}
					{disabled}
					aria-label={busy ? 'Thinking' : 'Send'}
				>
					{#if busy}
						<span class="tp-composer__send-loader">
							<span></span><span></span><span></span>
						</span>
					{:else}
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
							<path d="M7 12V2M3 6l4-4 4 4"/>
						</svg>
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.tp-composer {
		display: grid;
		gap: 0.55rem;
		padding: 0.75rem 1.5rem 1.25rem;
		background: linear-gradient(to top, var(--tp-bg, #0c0c0d) 65%, transparent);
		position: relative;
	}

	.tp-composer::before {
		content: '';
		position: absolute;
		top: -2.5rem;
		left: 0;
		right: 0;
		height: 2.5rem;
		background: linear-gradient(to top, var(--tp-bg, #0c0c0d), transparent);
		pointer-events: none;
	}

	.tp-composer__status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.1rem 0.2rem;
		font-size: 0.74rem;
		color: rgba(180, 180, 175, 0.78);
		max-width: max-content;
		margin: 0 auto;
	}

	.tp-composer__status-shimmer {
		display: inline-block;
		width: 4px;
		height: 4px;
		border-radius: 999px;
		background: var(--tp-accent, #c9a86c);
		animation: tp-shimmer 1.2s ease-in-out infinite;
	}

	@keyframes tp-shimmer {
		0%, 100% { opacity: 0.3; transform: scale(0.8); }
		50% { opacity: 1; transform: scale(1.4); }
	}

	.tp-composer__status-text {
		font-style: italic;
		font-family: var(--tp-font-display, 'Newsreader', Georgia, serif);
		font-size: 0.84rem;
		letter-spacing: -0.005em;
	}

	.tp-composer__field {
		width: min(100%, 44rem);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 0;
		background: rgba(255, 255, 255, 0.025);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.85rem;
		padding: 0.75rem 0.85rem 0.55rem;
		transition: border-color 180ms ease, background-color 180ms ease;
		position: relative;
	}

	.tp-composer__field:focus-within {
		border-color: rgba(255, 255, 255, 0.16);
		background: rgba(255, 255, 255, 0.035);
	}

	.tp-composer__field.is-busy {
		border-color: rgba(201, 168, 108, 0.22);
	}

	.tp-composer__textarea {
		width: 100%;
		min-height: 1.6rem;
		max-height: 13.75rem;
		resize: none;
		border: 0;
		background: transparent;
		color: rgba(237, 237, 234, 0.96);
		font-family: var(--tp-font-body, 'Geist', -apple-system, sans-serif);
		font-size: 0.94rem;
		line-height: 1.55;
		outline: none;
		padding: 0.15rem 0.1rem 0.4rem;
		letter-spacing: -0.005em;
	}

	.tp-composer__textarea::placeholder {
		color: rgba(140, 140, 138, 0.65);
	}

	.tp-composer__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		padding-top: 0.4rem;
	}

	.tp-composer__mode {
		position: relative;
	}

	.tp-composer__mode-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.55rem;
		border: 1px solid rgba(255, 255, 255, 0.07);
		background: transparent;
		border-radius: 0.45rem;
		font-family: inherit;
		font-size: 0.74rem;
		color: rgba(180, 180, 175, 0.85);
		cursor: pointer;
		transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
	}

	.tp-composer__mode-trigger:hover {
		border-color: rgba(255, 255, 255, 0.14);
		color: rgba(237, 237, 234, 0.96);
		background: rgba(255, 255, 255, 0.025);
	}

	.tp-composer__mode-dot {
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: var(--tp-accent, #c9a86c);
	}

	.tp-composer__mode-label {
		letter-spacing: -0.005em;
	}

	.tp-composer__mode-menu {
		position: absolute;
		bottom: calc(100% + 0.4rem);
		left: 0;
		min-width: 12rem;
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 0.3rem;
		background: #131314;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.6rem;
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
		z-index: 10;
		animation: tp-mode-in 140ms ease;
	}

	@keyframes tp-mode-in {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.tp-composer__mode-option {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.5rem 0.6rem;
		border: 0;
		background: transparent;
		border-radius: 0.4rem;
		text-align: left;
		font-family: inherit;
		cursor: pointer;
		transition: background-color 130ms ease;
	}

	.tp-composer__mode-option:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.tp-composer__mode-option.is-active {
		background: rgba(201, 168, 108, 0.08);
	}

	.tp-composer__mode-option-name {
		font-size: 0.82rem;
		font-weight: 500;
		color: rgba(237, 237, 234, 0.95);
		letter-spacing: -0.005em;
	}

	.tp-composer__mode-option-eyebrow {
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: rgba(140, 140, 138, 0.7);
	}

	.tp-composer__mode-option.is-active .tp-composer__mode-option-eyebrow {
		color: var(--tp-accent, #c9a86c);
	}

	.tp-composer__bar-right {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.tp-composer__hint {
		font-size: 0.68rem;
		color: rgba(140, 140, 138, 0.55);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.005em;
	}

	.tp-composer__send {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 0.45rem;
		border: 0;
		font-family: inherit;
		cursor: pointer;
		transition: background-color 140ms ease, color 140ms ease, opacity 140ms ease, transform 140ms ease;
	}

	.tp-composer__send.is-active {
		background: rgba(237, 237, 234, 0.95);
		color: #0c0c0d;
	}

	.tp-composer__send.is-active:hover {
		background: #ffffff;
		transform: translateY(-1px);
	}

	.tp-composer__send:not(.is-active) {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(140, 140, 138, 0.5);
		cursor: not-allowed;
	}

	.tp-composer__send-loader {
		display: inline-flex;
		gap: 2px;
	}

	.tp-composer__send-loader span {
		width: 3px;
		height: 3px;
		border-radius: 999px;
		background: currentColor;
		animation: tp-loader 1.1s ease-in-out infinite;
	}

	.tp-composer__send-loader span:nth-child(2) {
		animation-delay: 0.18s;
	}

	.tp-composer__send-loader span:nth-child(3) {
		animation-delay: 0.36s;
	}

	@keyframes tp-loader {
		0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
		40% { opacity: 1; transform: translateY(-2px); }
	}

	@media (max-width: 720px) {
		.tp-composer {
			padding: 0.6rem 1rem 0.9rem;
		}

		.tp-composer__hint {
			display: none;
		}
	}
</style>
