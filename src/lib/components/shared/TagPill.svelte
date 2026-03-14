<script lang="ts">
	let { name, color = '#3b82f6', category = '', removable = false, onremove }: {
		name: string;
		color?: string;
		category?: string;
		removable?: boolean;
		onremove?: (e: MouseEvent) => void;
	} = $props();


</script>

<span
	class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
	style="background-color: {color}20; color: {color}; border: 1px solid {color}40;"
>
	{name}
	{#if removable}
		<button
			type="button"
			onclick={onremove}
			class="ml-0.5 hover:opacity-70 transition-opacity"
		>
			×
		</button>
	{/if}
</span>
