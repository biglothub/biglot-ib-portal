<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import NotificationBell from '$lib/components/layout/NotificationBell.svelte';

	let { data, children } = $props();
	const profile = $derived(data.profile);
	let sidebarCollapsed = $state(false);

	const isAuthPage = $derived(!profile);
</script>

{#if isAuthPage}
	{@render children()}
{:else}
	<div class="flex h-screen bg-dark-bg text-white">
		<Sidebar {profile} bind:collapsed={sidebarCollapsed} />

		<div class="flex-1 flex flex-col overflow-hidden">
			<header class="h-12 shrink-0 flex items-center justify-end px-4 border-b border-dark-border">
				<NotificationBell userId={profile!.id} />
			</header>
			<main class="flex-1 overflow-auto">
				<div class="max-w-7xl mx-auto p-4 md:p-6">
					{@render children()}
				</div>
			</main>
		</div>
	</div>
{/if}
