<script lang="ts">
	import { getStatusBgColor, getStatusLabel } from '$lib/utils';

	let { status }: { status: string } = $props();
</script>

<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border {getStatusBgColor(status)}">
	{getStatusLabel(status)}
</span>
