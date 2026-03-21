<script lang="ts">
	import { invalidate } from '$app/navigation';
	import TiptapEditor from '$lib/components/portfolio/TiptapEditor.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';

	let { data } = $props();
	let folders = $derived(data.folders || []);
	let notes = $derived(data.notes || []);
	let deletedNotes = $derived(data.deletedNotes || []);

	let selectedFolderId = $state<string | null>(null); // null = "All notes"
	let showDeleted = $state(false);
	let selectedNoteId = $state<string | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let isSearching = $state(false);

	// New note state
	let editTitle = $state('');
	let editContent = $state('');
	let saving = $state(false);
	let showNewFolder = $state(false);
	let newFolderName = $state('');

	// Session recap state
	let recapDate = $state(new Date().toISOString().split('T')[0]);
	let generatingRecap = $state(false);
	let recapMessage = $state('');

	// Detect sessions recap folder
	const isSessionsFolder = $derived(
		folders.find((f: any) => f.id === selectedFolderId && f.system_type === 'sessions') != null
	);

	// Filtered notes by folder
	const filteredNotes = $derived((() => {
		if (showDeleted) return deletedNotes;
		if (searchQuery && searchResults.length > 0) return searchResults;
		if (selectedFolderId === null) return notes;
		return notes.filter((n: any) => n.folder_id === selectedFolderId);
	})());

	// Selected note
	const selectedNote = $derived(
		notes.find((n: any) => n.id === selectedNoteId) || null
	);

	// Load note into editor
	$effect(() => {
		if (selectedNote) {
			editTitle = selectedNote.title || '';
			editContent = selectedNote.content || '';
		}
	});

	// Folder counts
	function folderNoteCount(folderId: string | null) {
		if (folderId === null) return notes.length;
		return notes.filter((n: any) => n.folder_id === folderId).length;
	}

	// Auto-save debounce
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	function scheduleSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			if (selectedNoteId) saveNote();
		}, 2000);
	}

	// ── API calls ──

	async function createNote() {
		saving = true;
		try {
			const res = await fetch('/api/portfolio/notebook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create_note',
					folder_id: selectedFolderId,
					title: 'ไม่มีชื่อ',
					content: ''
				})
			});
			const data = await res.json();
			if (data.note) {
				selectedNoteId = data.note.id;
				editTitle = data.note.title;
				editContent = '';
			}
			await invalidate('portfolio:baseData');
		} finally {
			saving = false;
		}
	}

	async function saveNote() {
		if (!selectedNoteId) return;
		saving = true;
		try {
			await fetch('/api/portfolio/notebook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_note',
					note_id: selectedNoteId,
					title: editTitle,
					content: editContent
				})
			});
		} finally {
			saving = false;
		}
	}

	async function deleteNote(noteId: string) {
		await fetch('/api/portfolio/notebook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'delete_note', note_id: noteId })
		});
		if (selectedNoteId === noteId) {
			selectedNoteId = null;
			editTitle = '';
			editContent = '';
		}
		await invalidate('portfolio:baseData');
	}

	async function restoreNote(noteId: string) {
		await fetch('/api/portfolio/notebook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'restore_note', note_id: noteId })
		});
		await invalidate('portfolio:baseData');
	}

	async function createFolder() {
		if (!newFolderName.trim()) return;
		await fetch('/api/portfolio/notebook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'create_folder', name: newFolderName.trim() })
		});
		newFolderName = '';
		showNewFolder = false;
		await invalidate('portfolio:baseData');
	}

	async function deleteFolder(folderId: string) {
		await fetch('/api/portfolio/notebook', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'delete_folder', folder_id: folderId })
		});
		if (selectedFolderId === folderId) selectedFolderId = null;
		await invalidate('portfolio:baseData');
	}

	async function searchNotes() {
		if (!searchQuery.trim()) {
			searchResults = [];
			return;
		}
		isSearching = true;
		try {
			const res = await fetch('/api/portfolio/notebook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'search', query: searchQuery.trim() })
			});
			const data = await res.json();
			searchResults = data.notes || [];
		} finally {
			isSearching = false;
		}
	}

	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	function onSearchInput() {
		clearTimeout(searchTimer);
		if (!searchQuery.trim()) { searchResults = []; return; }
		searchTimer = setTimeout(searchNotes, 400);
	}

	async function generateSessionRecap() {
		if (!recapDate) return;
		generatingRecap = true;
		recapMessage = '';
		try {
			const res = await fetch('/api/portfolio/notebook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'generate_session_recap', date: recapDate })
			});
			const result = await res.json();
			if (res.ok && result.note) {
				selectedNoteId = result.note.id;
				editTitle = result.note.title;
				editContent = result.note.content;
				recapMessage = '';
				await invalidate('portfolio:baseData');
			} else if (res.status === 409) {
				recapMessage = 'มี Recap ของวันนี้แล้ว';
				if (result.existingId) selectedNoteId = result.existingId;
			} else if (res.status === 404 && result.message?.includes('No trades')) {
				recapMessage = 'ไม่พบเทรดในวันที่เลือก';
			} else {
				recapMessage = result.message || 'เกิดข้อผิดพลาด';
			}
		} catch {
			recapMessage = 'เกิดข้อผิดพลาด';
		} finally {
			generatingRecap = false;
		}
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function truncate(text: string, len: number) {
		if (!text) return '';
		const plain = text.replace(/<[^>]*>/g, '');
		return plain.length > len ? plain.slice(0, len) + '...' : plain;
	}
</script>

<div class="flex flex-col md:flex-row gap-4 h-[calc(100vh-220px)] min-h-[500px]">
	<!-- Sidebar: Folders + Note List -->
	<div class="w-full md:w-72 flex-shrink-0 flex flex-col gap-3 {selectedNoteId ? 'hidden md:flex' : 'flex'}">
		<!-- Search -->
		<div class="relative">
			<input
				bind:value={searchQuery}
				oninput={onSearchInput}
				placeholder="ค้นหาโน้ต..."
				class="w-full rounded-lg bg-dark-surface border border-dark-border px-3 py-2 text-sm text-white placeholder-gray-600 pl-8"
			/>
			<svg class="absolute left-2.5 top-2.5 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
			</svg>
		</div>

		<!-- Folders -->
		<div class="card flex-shrink-0 space-y-1">
			<div class="flex items-center justify-between mb-2">
				<span class="text-[10px] uppercase tracking-wider text-gray-600">โฟลเดอร์</span>
				<button onclick={() => showNewFolder = true} class="text-xs text-brand-primary hover:underline">+ สร้างใหม่</button>
			</div>

			<!-- All notes -->
			<button
				onclick={() => { selectedFolderId = null; showDeleted = false; }}
				class="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-left transition-colors
					{selectedFolderId === null && !showDeleted ? 'bg-brand-primary/10 text-brand-primary' : 'text-gray-300 hover:bg-dark-bg/50'}"
			>
				<span>📄 โน้ตทั้งหมด</span>
				<span class="text-xs text-gray-500">{folderNoteCount(null)}</span>
			</button>

			<!-- System + Custom folders -->
			{#each folders as folder}
				<div class="flex items-center group">
					<button
						onclick={() => { selectedFolderId = folder.id; showDeleted = false; }}
						class="flex-1 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-left transition-colors
							{selectedFolderId === folder.id ? 'bg-brand-primary/10 text-brand-primary' : 'text-gray-300 hover:bg-dark-bg/50'}"
					>
						<span>{folder.icon} {folder.name}</span>
						<span class="text-xs text-gray-500">{folderNoteCount(folder.id)}</span>
					</button>
					{#if folder.type === 'custom'}
						<button
							onclick={() => deleteFolder(folder.id)}
							class="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity"
							title="ลบโฟลเดอร์"
						>
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
						</button>
					{/if}
				</div>
			{/each}

			<!-- Deleted -->
			<button
				onclick={() => { showDeleted = true; selectedFolderId = null; }}
				class="w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-left transition-colors
					{showDeleted ? 'bg-brand-primary/10 text-brand-primary' : 'text-gray-500 hover:bg-dark-bg/50'}"
			>
				<span>🗑 ลบล่าสุด</span>
				<span class="text-xs text-gray-600">{deletedNotes.length}</span>
			</button>

			<!-- New folder inline form -->
			{#if showNewFolder}
				<div class="flex gap-1 mt-1">
					<input
						bind:value={newFolderName}
						placeholder="ชื่อโฟลเดอร์..."
						class="flex-1 rounded-md bg-dark-bg border border-dark-border px-2 py-1 text-xs text-white"
						onkeydown={(e) => { if (e.key === 'Enter') createFolder(); }}
					/>
					<button onclick={createFolder} class="text-xs text-brand-primary px-1">OK</button>
					<button onclick={() => { showNewFolder = false; newFolderName = ''; }} class="text-xs text-gray-500 px-1">✕</button>
				</div>
			{/if}
		</div>

		<!-- Session Recap Generator -->
		{#if isSessionsFolder}
			<div class="card flex-shrink-0 space-y-2">
				<span class="text-[10px] uppercase tracking-wider text-gray-600">สร้าง Session Recap</span>
				<div class="flex gap-2">
					<input
						type="date"
						bind:value={recapDate}
						max={new Date().toISOString().split('T')[0]}
						class="flex-1 rounded-md bg-dark-bg border border-dark-border px-2 py-1.5 text-xs text-white [color-scheme:dark]"
					/>
					<button
						onclick={generateSessionRecap}
						disabled={generatingRecap || !recapDate}
						class="px-3 py-1.5 rounded-md bg-brand-primary text-dark-bg text-xs font-medium disabled:opacity-50 whitespace-nowrap"
					>
						{#if generatingRecap}
							<span class="inline-flex items-center gap-1">
								<svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" class="opacity-75"></path></svg>
								กำลังสร้าง...
							</span>
						{:else}
							สร้าง Recap
						{/if}
					</button>
				</div>
				{#if recapMessage}
					<p class="text-[11px] text-amber-400">{recapMessage}</p>
				{/if}
			</div>
		{/if}

		<!-- Note List -->
		<div class="card flex-1 overflow-y-auto space-y-1">
			<div class="flex items-center justify-between mb-2">
				<span class="text-[10px] uppercase tracking-wider text-gray-600">
					{showDeleted ? 'ที่ลบแล้ว' : searchQuery ? 'ผลการค้นหา' : 'โน้ต'}
				</span>
				{#if !showDeleted}
					<button onclick={createNote} disabled={saving} class="text-xs text-brand-primary hover:underline">+ โน้ตใหม่</button>
				{/if}
			</div>

			{#if filteredNotes.length === 0}
				<div class="text-xs text-gray-600 text-center py-6">ไม่มีโน้ต</div>
			{:else}
				{#each filteredNotes as note}
					<button
						onclick={() => { if (!showDeleted) selectedNoteId = note.id; }}
						class="w-full text-left rounded-lg px-3 py-2 transition-colors
							{selectedNoteId === note.id ? 'bg-brand-primary/10 border border-brand-primary/30' : 'hover:bg-dark-bg/50'}"
					>
						<div class="text-sm font-medium text-white truncate">{note.title || 'ไม่มีชื่อ'}</div>
						<div class="text-[11px] text-gray-500 mt-0.5">{formatDate(note.updated_at || note.created_at)}</div>
						{#if !showDeleted}
							<div class="text-[11px] text-gray-600 mt-0.5 truncate">{truncate(note.content || '', 60)}</div>
						{/if}
					</button>

					{#if showDeleted}
						<div class="flex gap-2 px-3 pb-1">
							<button onclick={() => restoreNote(note.id)} class="text-[10px] text-green-400 hover:underline">กู้คืน</button>
						</div>
					{/if}
				{/each}
			{/if}
		</div>
	</div>

	<!-- Editor -->
	<div class="flex-1 card flex flex-col {selectedNoteId ? 'flex' : 'hidden md:flex'}">
		{#if selectedNoteId && selectedNote}
			<!-- Mobile back button -->
			<button
				onclick={() => { selectedNoteId = null; editTitle = ''; editContent = ''; }}
				class="md:hidden flex items-center gap-1 text-xs text-gray-400 hover:text-white mb-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
				กลับ
			</button>
			<!-- Title -->
			<input
				bind:value={editTitle}
				oninput={scheduleSave}
				placeholder="ชื่อโน้ต..."
				class="w-full bg-transparent border-none text-xl font-bold text-white placeholder-gray-600 outline-none mb-3"
			/>

			<!-- Toolbar -->
			<div class="flex items-center gap-2 pb-3 border-b border-dark-border mb-3">
				<span class="text-[10px] text-gray-600">
					{saving ? 'กำลังบันทึก...' : 'บันทึกอัตโนมัติแล้ว'}
				</span>
				<div class="flex-1"></div>
				<button
					onclick={() => deleteNote(selectedNoteId!)}
					class="text-xs text-gray-500 hover:text-red-400"
				>ลบ</button>
				<button
					onclick={saveNote}
					disabled={saving}
					class="px-3 py-1 rounded-md bg-brand-primary text-dark-bg text-xs font-medium"
				>บันทึก</button>
			</div>

			<!-- Rich text editor -->
			<div class="flex-1 overflow-y-auto">
				<TiptapEditor
					content={editContent}
					onupdate={(html) => { editContent = html; scheduleSave(); }}
					placeholder="เริ่มเขียน..."
				/>
			</div>
		{:else}
			<div class="flex-1 flex items-center justify-center">
				{#if isSessionsFolder && filteredNotes.length === 0}
					<EmptyState message="เลือกวันที่แล้วกด 'สร้าง Recap' เพื่อสรุปเทรดตาม Session" />
				{:else}
					<EmptyState message="เลือกโน้ตหรือสร้างโน้ตใหม่" />
				{/if}
			</div>
		{/if}
	</div>
</div>
