<script lang="ts">
	import type { TradePilotModeOption } from '$lib/tradepilot';

	interface Props {
		modeMeta: TradePilotModeOption;
		prompts: string[];
		onSendStarter?: (prompt: string) => void;
	}

	let { modeMeta, prompts, onSendStarter }: Props = $props();
</script>

<div class="tp-empty">
	<div class="tp-empty__hero">
		<div class="tp-empty__mark" aria-hidden="true">
			<span>◐</span>
		</div>
		<h1 class="tp-empty__title">
			How can I help with <em>{modeMeta.label.toLowerCase()}</em> today?
		</h1>
		<p class="tp-empty__copy">
			I have access to your portfolio, journal, reviews, and playbooks for this account.
			Ask in plain language — one clear question is enough.
		</p>
	</div>

	<div class="tp-empty__prompts">
		<div class="tp-empty__prompts-label">Try asking</div>
		<ul class="tp-empty__prompts-list">
			{#each prompts as prompt}
				<li>
					<button class="tp-empty__prompt" type="button" onclick={() => onSendStarter?.(prompt)}>
						<span class="tp-empty__prompt-text">{prompt}</span>
						<svg class="tp-empty__prompt-arrow" width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M3 5.5h5M6 3.5l2 2-2 2"/>
						</svg>
					</button>
				</li>
			{/each}
		</ul>
	</div>
</div>

<style>
	.tp-empty {
		display: grid;
		gap: 2.5rem;
		width: min(100%, 40rem);
	}

	.tp-empty__hero {
		display: grid;
		gap: 1rem;
		text-align: left;
	}

	.tp-empty__mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 2.4rem;
		font-size: 1.4rem;
		color: var(--tp-accent, #c9a86c);
		line-height: 1;
		margin-bottom: 0.35rem;
	}

	.tp-empty__title {
		margin: 0;
		font-family: var(--tp-font-display, 'Newsreader', 'Cormorant Garamond', Georgia, serif);
		font-size: clamp(1.85rem, 3.6vw, 2.55rem);
		font-weight: 400;
		line-height: 1.18;
		letter-spacing: -0.02em;
		color: rgba(245, 245, 242, 0.97);
	}

	.tp-empty__title em {
		font-style: italic;
		color: var(--tp-accent, #c9a86c);
		font-weight: 400;
	}

	.tp-empty__copy {
		margin: 0;
		max-width: 32rem;
		font-size: 0.92rem;
		line-height: 1.65;
		color: rgba(180, 180, 175, 0.78);
		letter-spacing: -0.005em;
	}

	.tp-empty__prompts {
		display: grid;
		gap: 0.85rem;
	}

	.tp-empty__prompts-label {
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(140, 140, 138, 0.65);
	}

	.tp-empty__prompts-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.tp-empty__prompts-list li {
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}

	.tp-empty__prompts-list li:last-child {
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.tp-empty__prompt {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		padding: 0.85rem 0.25rem;
		border: 0;
		background: transparent;
		text-align: left;
		font-family: inherit;
		font-size: 0.92rem;
		line-height: 1.5;
		color: rgba(220, 220, 216, 0.88);
		cursor: pointer;
		transition: color 140ms ease, padding 200ms cubic-bezier(0.32, 0.72, 0.24, 1);
		letter-spacing: -0.005em;
	}

	.tp-empty__prompt:hover {
		color: rgba(255, 255, 255, 0.98);
		padding-left: 0.6rem;
	}

	.tp-empty__prompt-text {
		flex: 1 1 auto;
	}

	.tp-empty__prompt-arrow {
		flex-shrink: 0;
		color: rgba(140, 140, 138, 0.45);
		transform: translateX(-3px);
		opacity: 0;
		transition: transform 200ms cubic-bezier(0.32, 0.72, 0.24, 1), opacity 160ms ease, color 140ms ease;
	}

	.tp-empty__prompt:hover .tp-empty__prompt-arrow {
		opacity: 1;
		transform: translateX(0);
		color: var(--tp-accent, #c9a86c);
	}

	@media (max-width: 720px) {
		.tp-empty {
			gap: 1.85rem;
		}

		.tp-empty__title {
			font-size: 1.65rem;
		}
	}
</style>
