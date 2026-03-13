<script lang="ts">
	let { label, value, subValue = '', color = 'text-white' }: {
		label: string;
		value: string;
		subValue?: string;
		color?: string;
	} = $props();
</script>

<div class="card">
	<p class="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
	<p class="text-xl font-bold mt-1 {color}">{value}</p>
	{#if subValue}
		<p class="text-xs text-gray-500 mt-0.5">{subValue}</p>
	{/if}
</div>
