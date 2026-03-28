<script lang="ts">
	let { profit }: { profit: number } = $props();
	const isWin = profit > 0.005;
	const isLoss = profit < -0.005;
</script>

{#if isWin}
	<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20 tabular-nums">
		WIN
	</span>
{:else if isLoss}
	<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20 tabular-nums">
		LOSS
	</span>
{:else}
	<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/20 tabular-nums">
		BE
	</span>
{/if}
