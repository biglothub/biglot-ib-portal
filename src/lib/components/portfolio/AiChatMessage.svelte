<script lang="ts">
	let { role, content }: { role: 'user' | 'assistant'; content: string } = $props();

	function renderMarkdown(text: string): string {
		// Sanitize: escape HTML
		let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		// Parse tables first (before newline processing)
		html = html.replace(
			/((?:^\|.+\|[ \t]*\n?)+)/gm,
			(tableBlock) => {
				const rows = tableBlock.trim().split('\n').filter(r => r.trim());
				if (rows.length < 2) return tableBlock;

				// Check if row 2 is separator (|---|---|)
				const isSeparator = (row: string) => /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(row.trim());
				const hasSeparator = isSeparator(rows[1]);

				const parseRow = (row: string) =>
					row.split('|').slice(1, -1).map(cell => cell.trim());

				let tableHtml = '<div class="ai-table-wrap"><table class="ai-table">';

				if (hasSeparator) {
					// Header row
					const headers = parseRow(rows[0]);
					tableHtml += '<thead><tr>';
					headers.forEach(h => { tableHtml += `<th>${applyInline(h)}</th>`; });
					tableHtml += '</tr></thead><tbody>';
					// Data rows
					for (let i = 2; i < rows.length; i++) {
						const cells = parseRow(rows[i]);
						tableHtml += '<tr>';
						cells.forEach(c => { tableHtml += `<td>${applyInline(c)}</td>`; });
						tableHtml += '</tr>';
					}
					tableHtml += '</tbody>';
				} else {
					tableHtml += '<tbody>';
					rows.forEach(row => {
						const cells = parseRow(row);
						tableHtml += '<tr>';
						cells.forEach(c => { tableHtml += `<td>${applyInline(c)}</td>`; });
						tableHtml += '</tr>';
					});
					tableHtml += '</tbody>';
				}

				tableHtml += '</table></div>';
				return tableHtml;
			}
		);

		// Headers
		html = html.replace(/^### (.+)$/gm, '<h4 class="ai-h3">$1</h4>');
		html = html.replace(/^## (.+)$/gm, '<h3 class="ai-h2">$1</h3>');
		html = html.replace(/^# (.+)$/gm, '<h2 class="ai-h1">$1</h2>');

		// Bullet lists — group consecutive lines starting with -
		html = html.replace(
			/((?:^- .+\n?)+)/gm,
			(block) => {
				const items = block.trim().split('\n').map(line => {
					const content = line.replace(/^- /, '');
					return `<li>${applyInline(content)}</li>`;
				});
				return `<ul class="ai-list">${items.join('')}</ul>`;
			}
		);

		// Numbered lists — group consecutive lines starting with number.
		html = html.replace(
			/((?:^\d+\. .+\n?)+)/gm,
			(block) => {
				const items = block.trim().split('\n').map(line => {
					const content = line.replace(/^\d+\. /, '');
					return `<li>${applyInline(content)}</li>`;
				});
				return `<ol class="ai-ol">${items.join('')}</ol>`;
			}
		);

		// Apply inline formatting
		html = applyInline(html);

		// Convert remaining newlines to <br> (but not inside tables/lists)
		html = html.replace(/\n/g, '<br>');

		// Clean up excessive <br> around block elements
		html = html.replace(/<br>\s*(<(?:h[2-4]|ul|ol|div|table))/g, '$1');
		html = html.replace(/(<\/(?:h[2-4]|ul|ol|div|table)>)\s*<br>/g, '$1');

		return html;
	}

	function applyInline(text: string): string {
		// Bold
		text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		// Italic
		text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
		// Inline code
		text = text.replace(/`(.+?)`/g, '<code class="ai-code">$1</code>');
		return text;
	}
</script>

<div class="flex {role === 'user' ? 'justify-end' : 'justify-start'}">
	<div
		class="max-w-[85%] px-4 py-2.5 text-sm leading-relaxed
			{role === 'user'
				? 'bg-brand-600 text-white rounded-2xl rounded-br-md'
				: 'bg-dark-hover text-gray-200 rounded-2xl rounded-bl-md ai-msg'}"
	>
		{@html renderMarkdown(content)}
	</div>
</div>

<style>
	:global(.ai-msg .ai-h1) {
		font-size: 1rem;
		font-weight: 700;
		color: white;
		margin: 0.75rem 0 0.25rem;
	}
	:global(.ai-msg .ai-h2) {
		font-size: 0.9rem;
		font-weight: 700;
		color: white;
		margin: 0.75rem 0 0.25rem;
	}
	:global(.ai-msg .ai-h3) {
		font-size: 0.85rem;
		font-weight: 600;
		color: #e5e7eb;
		margin: 0.6rem 0 0.2rem;
	}

	:global(.ai-msg .ai-list),
	:global(.ai-msg .ai-ol) {
		margin: 0.35rem 0;
		padding-left: 1.25rem;
	}
	:global(.ai-msg .ai-list) {
		list-style-type: disc;
	}
	:global(.ai-msg .ai-ol) {
		list-style-type: decimal;
	}
	:global(.ai-msg .ai-list li),
	:global(.ai-msg .ai-ol li) {
		margin: 0.15rem 0;
		line-height: 1.5;
	}

	:global(.ai-msg .ai-code) {
		background: rgba(255, 255, 255, 0.08);
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	:global(.ai-msg .ai-table-wrap) {
		overflow-x: auto;
		margin: 0.5rem 0;
		border-radius: 0.5rem;
		border: 1px solid #262626;
	}
	:global(.ai-msg .ai-table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
		white-space: nowrap;
	}
	:global(.ai-msg .ai-table th) {
		background: rgba(255, 255, 255, 0.05);
		padding: 0.4rem 0.6rem;
		text-align: left;
		font-weight: 600;
		color: #d1d5db;
		border-bottom: 1px solid #262626;
	}
	:global(.ai-msg .ai-table td) {
		padding: 0.35rem 0.6rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		color: #9ca3af;
	}
	:global(.ai-msg .ai-table tbody tr:last-child td) {
		border-bottom: none;
	}
	:global(.ai-msg .ai-table tbody tr:hover) {
		background: rgba(255, 255, 255, 0.02);
	}
</style>
