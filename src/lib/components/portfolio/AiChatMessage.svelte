<script lang="ts">
	import { sanitizeHtml } from '$lib/utils';

	let { role, content }: { role: 'user' | 'assistant'; content: string } = $props();

	function renderMarkdown(text: string): string {
		let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		html = html.replace(
			/((?:^\|.+\|[ \t]*\n?)+)/gm,
			(tableBlock) => {
				const rows = tableBlock.trim().split('\n').filter((row) => row.trim());
				if (rows.length < 2) return tableBlock;

				const isSeparator = (row: string) => /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(row.trim());
				const hasSeparator = isSeparator(rows[1]);
				const parseRow = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim());

				let tableHtml = '<div class="ai-table-wrap"><table class="ai-table">';

				if (hasSeparator) {
					tableHtml += '<thead><tr>';
					parseRow(rows[0]).forEach((cell) => {
						tableHtml += `<th>${applyInline(cell)}</th>`;
					});
					tableHtml += '</tr></thead><tbody>';

					for (let index = 2; index < rows.length; index += 1) {
						tableHtml += '<tr>';
						parseRow(rows[index]).forEach((cell) => {
							tableHtml += `<td>${applyInline(cell)}</td>`;
						});
						tableHtml += '</tr>';
					}

					tableHtml += '</tbody>';
				} else {
					tableHtml += '<tbody>';
					rows.forEach((row) => {
						tableHtml += '<tr>';
						parseRow(row).forEach((cell) => {
							tableHtml += `<td>${applyInline(cell)}</td>`;
						});
						tableHtml += '</tr>';
					});
					tableHtml += '</tbody>';
				}

				tableHtml += '</table></div>';
				return tableHtml;
			}
		);

		html = html.replace(/^### (.+)$/gm, (_, content) => `<h4 class="ai-h3">${escapeHtml(content)}</h4>`);
		html = html.replace(/^## (.+)$/gm, (_, content) => `<h3 class="ai-h2">${escapeHtml(content)}</h3>`);
		html = html.replace(/^# (.+)$/gm, (_, content) => `<h2 class="ai-h1">${escapeHtml(content)}</h2>`);

		html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
			const items = block.trim().split('\n').map((line) => `<li>${applyInline(line.replace(/^- /, ''))}</li>`);
			return `<ul class="ai-list">${items.join('')}</ul>`;
		});

		html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
			const items = block.trim().split('\n').map((line) => `<li>${applyInline(line.replace(/^\d+\. /, ''))}</li>`);
			return `<ol class="ai-ol">${items.join('')}</ol>`;
		});

		html = applyInline(html);
		html = html.replace(/\n/g, '<br>');
		html = html.replace(/<br>\s*(<(?:h[2-4]|ul|ol|div|table))/g, '$1');
		html = html.replace(/(<\/(?:h[2-4]|ul|ol|div|table)>)\s*<br>/g, '$1');

		return html;
	}

	function escapeHtml(str: string): string {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function applyInline(text: string): string {
		text = text.replace(/\*\*(.+?)\*\*/g, (_, content) => `<strong>${escapeHtml(content)}</strong>`);
		text = text.replace(/\*(.+?)\*/g, (_, content) => `<em>${escapeHtml(content)}</em>`);
		text = text.replace(/`(.+?)`/g, (_, content) => `<code class="ai-code">${escapeHtml(content)}</code>`);
		return text;
	}
</script>

<div class="ai-row {role === 'user' ? 'is-user' : 'is-assistant'}">
	<div class="ai-dot" aria-hidden="true"></div>
	<div class="ai-bubble ai-msg {role === 'user' ? 'is-user' : 'is-assistant'}">
		{#if role === 'assistant'}
			<div class="ai-eyebrow">TradePilot</div>
		{/if}
		<div class="ai-content">
			{@html sanitizeHtml(renderMarkdown(content))}
		</div>
	</div>
</div>

<style>
	.ai-row {
		display: flex;
		align-items: flex-start;
		gap: 0.7rem;
	}

	.ai-row.is-user {
		flex-direction: row-reverse;
	}

	.ai-dot {
		width: 0.55rem;
		height: 0.55rem;
		flex: 0 0 auto;
		margin-top: 0.9rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.18);
	}

	.ai-row.is-user .ai-dot {
		background: rgba(255, 255, 255, 0.28);
	}

	.ai-bubble {
		max-width: min(100%, 46rem);
		border-radius: 0.95rem;
		padding: 0.95rem 1.05rem;
		font-size: 0.94rem;
		line-height: 1.65;
	}

	.ai-bubble.is-assistant {
		border: 1px solid rgba(255, 255, 255, 0.06);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.022));
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
		color: rgba(229, 231, 235, 0.95);
	}

	.ai-bubble.is-user {
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.055);
		color: rgba(250, 250, 250, 0.96);
	}

	.ai-eyebrow {
		margin-bottom: 0.55rem;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(223, 194, 130, 0.9);
	}

	.ai-content {
		text-wrap: pretty;
	}

	:global(.ai-msg p) {
		margin: 0.38rem 0;
	}

	:global(.ai-msg p:first-child) {
		margin-top: 0;
	}

	:global(.ai-msg p:last-child) {
		margin-bottom: 0;
	}

	:global(.ai-msg blockquote) {
		margin: 0.65rem 0;
		padding: 0.55rem 0.75rem;
		border-left: 2px solid rgba(216, 184, 108, 0.42);
		background: rgba(255, 255, 255, 0.025);
		border-radius: 0 0.55rem 0.55rem 0;
		color: rgba(221, 221, 226, 0.9);
	}

	:global(.ai-msg .ai-h1) {
		margin: 0.8rem 0 0.28rem;
		font-size: 1.08rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.98);
		letter-spacing: -0.02em;
	}

	:global(.ai-msg .ai-h2) {
		margin: 0.75rem 0 0.26rem;
		font-size: 0.96rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.96);
		letter-spacing: -0.01em;
	}

	:global(.ai-msg .ai-h3) {
		margin: 0.7rem 0 0.24rem;
		font-size: 0.88rem;
		font-weight: 600;
		color: rgba(234, 234, 235, 0.94);
	}

	:global(.ai-msg .ai-list),
	:global(.ai-msg .ai-ol) {
		margin: 0.45rem 0;
		padding-left: 1.15rem;
	}

	:global(.ai-msg .ai-list) {
		list-style: disc;
	}

	:global(.ai-msg .ai-ol) {
		list-style: decimal;
	}

	:global(.ai-msg .ai-list li),
	:global(.ai-msg .ai-ol li) {
		margin: 0.2rem 0;
		padding-left: 0.15rem;
	}

	:global(.ai-msg hr) {
		margin: 0.8rem 0;
		border: 0;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}

	:global(.ai-msg .ai-code) {
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.4rem;
		background: rgba(255, 255, 255, 0.065);
		padding: 0.1rem 0.38rem;
		font-size: 0.82rem;
		font-family: 'SF Mono', 'Fira Code', monospace;
		color: rgba(245, 232, 198, 0.96);
	}

	:global(.ai-msg .ai-table-wrap) {
		overflow-x: auto;
		margin: 0.65rem 0 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.025);
	}

	:global(.ai-msg .ai-table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.76rem;
		white-space: nowrap;
	}

	:global(.ai-msg .ai-table th) {
		padding: 0.55rem 0.7rem;
		text-align: left;
		font-weight: 600;
		color: rgba(248, 248, 249, 0.94);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}

	:global(.ai-msg .ai-table td) {
		padding: 0.5rem 0.7rem;
		color: rgba(212, 212, 216, 0.92);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	:global(.ai-msg .ai-table tbody tr:last-child td) {
		border-bottom: none;
	}

	:global(.ai-msg .ai-table tbody tr:nth-child(even) td) {
		background: rgba(255, 255, 255, 0.015);
	}

	:global(.ai-msg strong) {
		color: rgba(255, 247, 224, 0.98);
		font-weight: 700;
	}

	:global(.ai-msg em) {
		color: rgba(230, 230, 235, 0.94);
	}

	@media (max-width: 720px) {
		.ai-bubble {
			padding: 0.88rem 0.9rem;
			font-size: 0.9rem;
		}
	}
</style>
