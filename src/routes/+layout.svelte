<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';

	let { data, children } = $props();
	const { profile } = data;

	const isAuthPage = $derived(!profile);
</script>

{#if isAuthPage}
	{@render children()}
{:else}
	<div class="flex h-screen bg-dark-bg text-white">
		<Sidebar {profile} />

		<main class="flex-1 overflow-auto">
			<div class="max-w-7xl mx-auto p-4 md:p-6">
				{@render children()}
			</div>
		</main>
	</div>
{/if}
