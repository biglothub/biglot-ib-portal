<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Placeholder from '@tiptap/extension-placeholder';

	let {
		content = '',
		onupdate,
		placeholder = 'Start writing...'
	}: {
		content?: string;
		onupdate?: (html: string) => void;
		placeholder?: string;
	} = $props();

	let editorElement = $state<HTMLDivElement>(undefined!);
	let editor = $state<Editor | undefined>(undefined);

	// Toolbar active states
	let isBold = $state(false);
	let isItalic = $state(false);
	let isStrike = $state(false);
	let isBulletList = $state(false);
	let isOrderedList = $state(false);
	let isBlockquote = $state(false);
	let isCodeBlock = $state(false);
	let headingLevel = $state(0);

	function updateActiveStates() {
		if (!editor) return;
		isBold = editor.isActive('bold');
		isItalic = editor.isActive('italic');
		isStrike = editor.isActive('strike');
		isBulletList = editor.isActive('bulletList');
		isOrderedList = editor.isActive('orderedList');
		isBlockquote = editor.isActive('blockquote');
		isCodeBlock = editor.isActive('codeBlock');
		headingLevel = editor.isActive('heading', { level: 1 }) ? 1 : editor.isActive('heading', { level: 2 }) ? 2 : 0;
	}

	onMount(() => {
		editor = new Editor({
			element: editorElement,
			extensions: [
				StarterKit.configure({
					heading: { levels: [1, 2] },
				}),
				Placeholder.configure({ placeholder }),
			],
			content,
			editorProps: {
				attributes: {
					class: 'tiptap-content outline-none min-h-[200px] text-sm text-gray-200 leading-relaxed',
				},
			},
			onUpdate: ({ editor: e }) => {
				const html = e.getHTML();
				onupdate?.(html);
				updateActiveStates();
			},
			onSelectionUpdate: () => updateActiveStates(),
		});
	});

	onDestroy(() => {
		editor?.destroy();
	});

	// Update editor content when prop changes externally
	$effect(() => {
		if (editor && content !== undefined) {
			const current = editor.getHTML();
			if (current !== content) {
				editor.commands.setContent(content, false);
			}
		}
	});

	// Toolbar button helper
	function tbClass(active: boolean) {
		return `p-1.5 rounded transition-colors ${active ? 'bg-dark-bg text-brand-primary' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-bg/50'}`;
	}
</script>

<div class="border border-dark-border rounded-xl overflow-hidden">
	<!-- Toolbar -->
	<div class="flex items-center gap-0.5 px-2 py-1.5 border-b border-dark-border bg-dark-surface/50 flex-wrap">
		<button type="button" class={tbClass(isBold)} onclick={() => editor?.chain().focus().toggleBold().run()} title="Bold">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
		</button>
		<button type="button" class={tbClass(isItalic)} onclick={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
		</button>
		<button type="button" class={tbClass(isStrike)} onclick={() => editor?.chain().focus().toggleStrike().run()} title="Strikethrough">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
		</button>

		<div class="w-px h-5 bg-dark-border mx-1"></div>

		<button type="button" class={tbClass(headingLevel === 1)} onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
			<span class="text-xs font-bold w-4 h-4 flex items-center justify-center">H1</span>
		</button>
		<button type="button" class={tbClass(headingLevel === 2)} onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
			<span class="text-xs font-bold w-4 h-4 flex items-center justify-center">H2</span>
		</button>

		<div class="w-px h-5 bg-dark-border mx-1"></div>

		<button type="button" class={tbClass(isBulletList)} onclick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet List">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
		</button>
		<button type="button" class={tbClass(isOrderedList)} onclick={() => editor?.chain().focus().toggleOrderedList().run()} title="Ordered List">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="3" y="8" font-size="7" fill="currentColor" stroke="none">1</text><text x="3" y="14" font-size="7" fill="currentColor" stroke="none">2</text><text x="3" y="20" font-size="7" fill="currentColor" stroke="none">3</text></svg>
		</button>

		<div class="w-px h-5 bg-dark-border mx-1"></div>

		<button type="button" class={tbClass(isBlockquote)} onclick={() => editor?.chain().focus().toggleBlockquote().run()} title="Blockquote">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
		</button>
		<button type="button" class={tbClass(isCodeBlock)} onclick={() => editor?.chain().focus().toggleCodeBlock().run()} title="Code Block">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
		</button>

		<div class="w-px h-5 bg-dark-border mx-1"></div>

		<button type="button" class="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-dark-bg/50 transition-colors" onclick={() => editor?.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/></svg>
		</button>
	</div>

	<!-- Editor -->
	<div bind:this={editorElement} class="px-4 py-3"></div>
</div>

<style>
	:global(.tiptap-content h1) {
		font-size: 1.25rem;
		font-weight: 700;
		color: white;
		margin: 0.75rem 0 0.5rem;
	}
	:global(.tiptap-content h2) {
		font-size: 1.1rem;
		font-weight: 600;
		color: white;
		margin: 0.5rem 0 0.25rem;
	}
	:global(.tiptap-content p) {
		margin: 0.25rem 0;
	}
	:global(.tiptap-content ul) {
		list-style: disc;
		padding-left: 1.5rem;
		margin: 0.25rem 0;
	}
	:global(.tiptap-content ol) {
		list-style: decimal;
		padding-left: 1.5rem;
		margin: 0.25rem 0;
	}
	:global(.tiptap-content li) {
		margin: 0.125rem 0;
	}
	:global(.tiptap-content blockquote) {
		border-left: 3px solid #C9A84C;
		padding-left: 1rem;
		margin: 0.5rem 0;
		font-style: italic;
		color: #9CA3AF;
	}
	:global(.tiptap-content pre) {
		background: #0a0a0a;
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		font-family: monospace;
		font-size: 0.8rem;
		margin: 0.5rem 0;
		overflow-x: auto;
	}
	:global(.tiptap-content code) {
		background: #1a1a1a;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.85em;
		font-family: monospace;
	}
	:global(.tiptap-content hr) {
		border-color: #262626;
		margin: 1rem 0;
	}
	:global(.tiptap-content .is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: #4B5563;
		pointer-events: none;
		height: 0;
	}
	:global(.tiptap-content strong) {
		color: white;
	}
</style>
