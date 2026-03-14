<script lang="ts">
	let { role, content }: { role: 'user' | 'assistant'; content: string } = $props();

	function renderMarkdown(text: string): string {
		// Sanitize: escape HTML
		let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		// Bold
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		// Newlines
		html = html.replace(/\n/g, '<br>');
		return html;
	}
</script>

<div class="flex {role === 'user' ? 'justify-end' : 'justify-start'}">
	<div
		class="max-w-[85%] px-4 py-2.5 text-sm leading-relaxed
			{role === 'user'
				? 'bg-brand-600 text-white rounded-2xl rounded-br-md'
				: 'bg-dark-hover text-gray-200 rounded-2xl rounded-bl-md'}"
	>
		{@html renderMarkdown(content)}
	</div>
</div>
