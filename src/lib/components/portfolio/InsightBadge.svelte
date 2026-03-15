<script lang="ts">
	let { count = 0, positive = 0, negative = 0 }: {
		count?: number;
		positive?: number;
		negative?: number;
	} = $props();
</script>

{#if count > 0}
	<div class="inline-flex items-center gap-1">
		{#if positive > 0}
			<span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">{positive}</span>
		{/if}
		{#if negative > 0}
			<span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">{negative}</span>
		{/if}
		{#if count - positive - negative > 0}
			<span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">{count - positive - negative}</span>
		{/if}
	</div>
{/if}
