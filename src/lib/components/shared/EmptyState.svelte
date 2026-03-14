<script lang="ts">
	let { message = 'ไม่มีข้อมูล', icon = '' }: {
		message?: string;
		icon?: string;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-gray-500">
	<p class="text-sm">{message}</p>
</div>
