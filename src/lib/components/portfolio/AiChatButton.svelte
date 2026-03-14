<script lang="ts">
	import { onMount } from 'svelte';

	let { onclick }: { onclick: () => void } = $props();
	let bouncing = $state(true);

	onMount(() => {
		const timer = setTimeout(() => { bouncing = false; }, 3000);
		return () => clearTimeout(timer);
	});
</script>

<button
	{onclick}
	class="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700
		shadow-lg shadow-brand-600/20 flex items-center justify-center
		transition-transform duration-200 hover:scale-110 cursor-pointer
		{bouncing ? 'animate-bounce' : ''}"
	aria-label="เปิด AI ผู้ช่วยเทรด"
>
	<svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
		<path stroke-linecap="round" stroke-linejoin="round"
			d="M8.5 3v2M15.5 3v2M5 8.5h14M7 6.5h10a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8a2 2 0 012-2zM9.5 11.5h0M14.5 11.5h0M9.5 14.5h5M7 18.5l-1.5 2M17 18.5l1.5 2" />
	</svg>
</button>
