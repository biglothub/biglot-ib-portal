<script lang="ts">
	let { score = 0 }: { score?: number } = $props();

	const color = $derived(
		score >= 70 ? 'bg-green-500' :
		score >= 50 ? 'bg-amber-500' :
		score >= 30 ? 'bg-orange-500' :
		'bg-red-500'
	);
</script>

<div class="flex items-center gap-1.5" title="Quality Score: {score}/100">
	<div class="w-14 h-1.5 rounded-full bg-dark-border overflow-hidden">
		<div class="{color} h-full rounded-full transition-all" style="width: {score}%"></div>
	</div>
	<span class="text-[10px] text-gray-500">{score}</span>
</div>
