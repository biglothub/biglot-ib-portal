<script lang="ts">
	let {
		items = [],
		label = 'Checklist',
		placeholder = 'เพิ่มรายการ...',
		onchange = (_items: string[]) => {}
	}: {
		items?: string[];
		label?: string;
		placeholder?: string;
		onchange?: (items: string[]) => void;
	} = $props();

	let draft = $state('');

	function commit(nextItems: string[]) {
		onchange(nextItems.filter(Boolean).map((item) => item.trim()).filter(Boolean));
	}

	function addItem() {
		if (!draft.trim()) return;
		commit([...(items || []), draft.trim()]);
		draft = '';
	}

	function updateItem(index: number, value: string) {
		const next = [...(items || [])];
		next[index] = value;
		commit(next);
	}

	function removeItem(index: number) {
		commit((items || []).filter((_, i) => i !== index));
	}
</script>

<div class="space-y-2">
	<div class="text-xs text-gray-500">{label}</div>
	<div class="space-y-2">
		{#each items as item, index}
			<div class="flex items-center gap-2">
				<input
					type="text"
					value={item}
					oninput={(event) => updateItem(index, (event.currentTarget as HTMLInputElement).value)}
					class="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
				/>
				<button
					type="button"
					onclick={() => removeItem(index)}
					class="text-xs text-red-300 hover:text-red-200"
				>
					ลบ
				</button>
			</div>
		{/each}
	</div>
	<div class="flex items-center gap-2">
		<input
			type="text"
			bind:value={draft}
			placeholder={placeholder}
			class="flex-1 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"
		/>
		<button type="button" onclick={addItem} class="btn-primary text-sm px-3 py-2">
			เพิ่ม
		</button>
	</div>
</div>
