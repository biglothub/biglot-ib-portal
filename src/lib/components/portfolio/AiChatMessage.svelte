<script lang="ts">
	import { sanitizeHtml } from '$lib/utils';

	let { role, content, isStreaming = false }: { role: 'user' | 'assistant'; content: string; isStreaming?: boolean } = $props();

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

		html = html.replace(/^### (.+)$/gm, (_, c) => `<h4 class="ai-h3">${escapeHtml(c)}</h4>`);
		html = html.replace(/^## (.+)$/gm, (_, c) => `<h3 class="ai-h2">${escapeHtml(c)}</h3>`);
		html = html.replace(/^# (.+)$/gm, (_, c) => `<h2 class="ai-h1">${escapeHtml(c)}</h2>`);

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
		text = text.replace(/\*\*(.+?)\*\*/g, (_, c) => `<strong>${escapeHtml(c)}</strong>`);
		text = text.replace(/\*(.+?)\*/g, (_, c) => `<em>${escapeHtml(c)}</em>`);
		text = text.replace(/`(.+?)`/g, (_, c) => `<code class="ai-code">${escapeHtml(c)}</code>`);
		return text;
	}
</script>

<div class="ai-row {role === 'user' ? 'is-user' : 'is-assistant'}">
	<div class="ai-bubble {role === 'user' ? 'is-user' : 'is-assistant'}">
		<div class="ai-content ai-msg">
			{@html sanitizeHtml(renderMarkdown(content))}
			{#if isStreaming}
				<span class="ai-cursor" aria-hidden="true"></span>
			{/if}
		</div>
	</div>
</div>

<style>
	.ai-row {
		display: flex;
		min-width: 0;
	}

	.ai-row.is-user {
		justify-content: flex-end;
	}

	.ai-row.is-assistant {
		justify-content: flex-start;
	}

	.ai-bubble {
		font-size: 0.94rem;
		line-height: 1.7;
		min-width: 0;
		letter-spacing: -0.005em;
	}

	.ai-bubble.is-user {
		max-width: 80%;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 0.85rem;
		padding: 0.65rem 0.9rem;
		color: rgba(245, 245, 242, 0.97);
	}

	.ai-bubble.is-assistant {
		width: 100%;
		background: transparent;
		border: 0;
		padding: 0;
		color: rgba(228, 228, 222, 0.94);
	}

	/* Streaming cursor */
	@keyframes tp-blink {
		0%, 100% { opacity: 0.7; }
		50% { opacity: 0; }
	}

	.ai-cursor {
		display: inline-block;
		width: 7px;
		height: 1.05em;
		margin-left: 2px;
		background: currentColor;
		opacity: 0.7;
		border-radius: 1px;
		vertical-align: text-bottom;
		animation: tp-blink 0.6s steps(2) infinite;
	}

	/* Markdown content styles */
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
		.ai-bubble.is-user,
		.ai-bubble.is-assistant {
			font-size: 0.9rem;
		}
	}
</style>
