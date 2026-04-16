<script lang="ts">
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { TradeTag, TagCategory } from '$lib/types';

	let { tags = [], ontagschange = () => {} } = $props();

	let showForm = $state(false);
	let newName = $state('');
	let newCategory: TagCategory = $state('setup');
	let newColor = $state('#C9A84C');
	let saving = $state(false);
	let error = $state('');

	const categories: { value: TagCategory; label: string }[] = [
		{ value: 'setup', label: 'Setup' },
		{ value: 'execution', label: 'Execution' },
		{ value: 'emotion', label: 'Emotion' },
		{ value: 'mistake', label: 'Mistake' },
		{ value: 'market_condition', label: 'Market' },
		{ value: 'custom', label: 'Custom' },
	];

	const colors = ['#C9A84C', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

	async function createTag() {
		if (!newName.trim()) return;
		saving = true;
		error = '';

		try {
			const res = await fetch('/api/portfolio/tags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName.trim(), category: newCategory, color: newColor })
			});

			if (!res.ok) {
				const data = await res.json();
				error = data.message || 'Failed to create tag';
				toast.error('สร้าง Tag ไม่สำเร็จ', { detail: error });
				return;
			}

			const tagName = newName.trim();
			newName = '';
			showForm = false;
			toast.success('สร้าง Tag แล้ว', { detail: tagName });
			ontagschange();
		} finally {
			saving = false;
		}
	}

	async function deleteTag(tagId: string) {
		const tag = tags.find((t: TradeTag) => t.id === tagId);
		const res = await fetch('/api/portfolio/tags', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: tagId })
		});

		if (res.ok) {
			toast.success('ลบ Tag แล้ว', { detail: tag?.name });
			ontagschange();
		} else {
			toast.error('ลบ Tag ไม่สำเร็จ');
		}
	}

	const groupedTags = $derived.by(() => {
		const groups: Record<string, TradeTag[]> = {};
		for (const tag of tags) {
			if (!groups[tag.category]) groups[tag.category] = [];
			groups[tag.category].push(tag);
		}
		return groups;
	});
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-gray-400">Tags</h3>
		<button
			type="button"
			onclick={() => showForm = !showForm}
			class="text-xs text-brand-primary hover:text-brand-primary/80"
		>
			{showForm ? 'ยกเลิก' : '+ เพิ่ม Tag'}
		</button>
	</div>

	{#if showForm}
		<div class="card p-3 space-y-3">
			<input
				type="text"
				bind:value={newName}
				placeholder="ชื่อ Tag..."
				class="w-full bg-dark-bg border border-dark-border rounded px-3 py-1.5 text-sm text-white"
				maxlength="30"
			/>

			<div class="flex gap-2">
				<select
					bind:value={newCategory}
					class="flex-1 bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
				>
					{#each categories as cat}
						<option value={cat.value}>{cat.label}</option>
					{/each}
				</select>
			</div>

			<div class="flex gap-1.5">
				{#each colors as c}
					<button
						type="button"
						onclick={() => newColor = c}
						aria-label={`Select color ${c}`}
						class="w-6 h-6 rounded-full border-2 transition-all {newColor === c ? 'border-gray-300 scale-110' : 'border-transparent'}"
						style="background-color: {c};"
					></button>
				{/each}
			</div>

			{#if error}
				<p class="text-xs text-red-400">{error}</p>
			{/if}

			<button
				type="button"
				onclick={createTag}
				disabled={saving || !newName.trim()}
				class="w-full btn-primary text-sm py-1.5 disabled:opacity-50"
			>
				{saving ? 'กำลังบันทึก...' : 'สร้าง Tag'}
			</button>
		</div>
	{/if}

	{#if tags.length === 0}
		<p class="text-xs text-gray-400">ยังไม่มี Tag — สร้าง Tag เพื่อจัดหมวดหมู่ Trade</p>
	{:else}
		<div class="flex flex-wrap gap-1.5">
			{#each tags as tag}
				<TagPill
					name={tag.name}
					color={tag.color}
					category={tag.category}
					removable={true}
					onremove={() => deleteTag(tag.id)}
				/>
			{/each}
		</div>
	{/if}
</div>
