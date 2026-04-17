<script lang="ts">
	import type { BigLotAiMode } from '$lib/types';
	import type { TradePilotModeOption } from '$lib/tradepilot';

	interface Props {
		mode: BigLotAiMode;
		modeMeta: TradePilotModeOption;
		prompts: string[];
		onSendStarter?: (prompt: string) => void;
		onSetPrompt?: (prompt: string) => void;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let { mode: _mode, modeMeta, prompts, onSendStarter, onSetPrompt: _onSetPrompt }: Props = $props();
</script>

<div class="tp-empty">
	<div class="tp-empty__hero">
		<p class="tp-empty__eyebrow">{modeMeta.eyebrow}</p>
		<h1 class="tp-empty__title">TradePilot</h1>
		<p class="tp-empty__copy">
			คุยกับข้อมูลใน account นี้โดยตรง เลือก mode ให้ตรง intent แล้วถามเป็นประโยคเดียวที่ชัดก่อน
			TradePilot จะดึง context จาก portfolio, journal, reviews และ playbooks ตาม mode ที่เลือกไว้
		</p>
	</div>

	<div class="tp-empty__grid">
		{#each prompts as prompt, index}
			<button class="tp-empty__card" type="button" onclick={() => onSendStarter?.(prompt)}>
				<span class="tp-empty__card-index">0{index + 1}</span>
				<span class="tp-empty__card-copy">{prompt}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.tp-empty {
		display: grid;
		gap: 1.2rem;
		width: min(100%, 48rem);
	}

	.tp-empty__hero {
		display: grid;
		gap: 0.5rem;
	}

	.tp-empty__eyebrow {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(216, 184, 108, 0.88);
	}

	.tp-empty__title {
		margin: 0;
		font-size: clamp(2.4rem, 5vw, 3.4rem);
		font-weight: 650;
		letter-spacing: -0.06em;
		color: rgba(250, 250, 249, 0.98);
	}

	.tp-empty__copy {
		margin: 0;
		max-width: 38rem;
		font-size: 0.92rem;
		line-height: 1.75;
		color: rgba(214, 211, 209, 0.9);
	}

	.tp-empty__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: 0.9rem;
	}

	.tp-empty__card {
		display: grid;
		gap: 0.7rem;
		padding: 1rem 1.05rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1.25rem;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
			radial-gradient(circle at top left, rgba(201, 168, 76, 0.12), transparent 52%);
		text-align: left;
		color: rgba(245, 245, 244, 0.95);
		transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
	}

	.tp-empty__card:hover {
		transform: translateY(-1px);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
			radial-gradient(circle at top left, rgba(201, 168, 76, 0.18), transparent 56%);
		border-color: rgba(216, 184, 108, 0.22);
	}

	.tp-empty__card-index {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(216, 184, 108, 0.84);
	}

	.tp-empty__card-copy {
		font-size: 0.94rem;
		line-height: 1.65;
	}
</style>
