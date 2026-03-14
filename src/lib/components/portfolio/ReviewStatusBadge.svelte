<script lang="ts">
	import { REVIEW_STATUS_LABELS, REVIEW_STATUS_STYLES } from '$lib/portfolio';
	import type { ReviewStatus } from '$lib/types';

	let { status = 'unreviewed' as ReviewStatus } = $props();
</script>

<span class={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium ${REVIEW_STATUS_STYLES[status]}`}>
	{REVIEW_STATUS_LABELS[status]}
</span>
