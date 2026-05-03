<script lang="ts">
	import '../app.css';
	import { navigating } from '$app/stores';
	import { afterNavigate, onNavigate } from '$app/navigation';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import NotificationBell from '$lib/components/layout/NotificationBell.svelte';
	import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte';

	import InstallPrompt from '$lib/components/layout/InstallPrompt.svelte';
	import PushPermission from '$lib/components/layout/PushPermission.svelte';

	let { data, children } = $props();
	const profile = $derived(data.profile);
	let sidebarCollapsed = $state(
		typeof localStorage !== 'undefined'
			? localStorage.getItem('sidebar-collapsed') === 'true'
			: false
	);

	$effect(() => {
		localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
	});

	const isAuthPage = $derived(!profile);

	// View Transitions — smooth page swap
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Track last visited route for /offline fallback
	afterNavigate(({ to }) => {
		if (!to?.url) return;
		if (to.url.pathname === '/offline' || to.url.pathname.startsWith('/auth/')) return;
		localStorage.setItem('pwa.lastRoute', `${to.url.pathname}${to.url.search}${to.url.hash}`);
	});
</script>

{#if $navigating}
	<div class="fixed top-0 left-0 right-0 z-[9999] h-[2px] bg-brand-primary/20 overflow-hidden">
		<div class="h-full bg-gradient-to-r from-brand-primary to-brand-300 animate-progress-bar rounded-r"></div>
	</div>
{/if}

{#if isAuthPage}
	{@render children()}
{:else}
	<div class="flex h-screen bg-dark-bg text-white">
		<Sidebar {profile} bind:collapsed={sidebarCollapsed} />

		<div class="flex-1 flex flex-col overflow-hidden">
			<header class="h-12 shrink-0 flex items-center justify-end gap-1 border-b border-dark-border bg-dark-elevated/70 px-4 backdrop-blur">
				<ThemeToggle />
				<NotificationBell userId={profile!.id} />
			</header>
			<main class="flex-1 overflow-auto">
				<div class="max-w-7xl mx-auto p-4 md:p-6">
					{@render children()}
				</div>
			</main>
		</div>
	</div>

	<InstallPrompt />
	{#if data.vapidPublicKey}
		<PushPermission userId={profile!.id} vapidPublicKey={data.vapidPublicKey} />
	{/if}
{/if}
