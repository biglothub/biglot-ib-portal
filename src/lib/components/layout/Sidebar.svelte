<script lang="ts">
	import { page } from '$app/stores';
	import SidebarNews from './SidebarNews.svelte';

	let { profile, collapsed = $bindable(false) } = $props();

	let mobileOpen = $state(false);

	const adminLinks = [
		{ href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
		{ href: '/admin/approvals', label: 'อนุมัติลูกค้า', icon: '✅', exact: false },
		{ href: '/admin/ibs', label: 'Master IBs', icon: '👥', exact: false },
	];

	const ibLinks = [
		{ href: '/ib', label: 'Dashboard', icon: '📊', exact: true },
		{ href: '/ib/clients', label: 'ลูกค้าของฉัน', icon: '👤', exact: false },
		{ href: '/ib/clients/add', label: 'เพิ่มลูกค้า', icon: '➕', exact: false },
	];

	const clientLinks = [
		{ href: '/portfolio', label: 'พอร์ตของฉัน', icon: '📈', exact: false },
	];

	const links = $derived(
		profile?.role === 'admin' ? adminLinks :
		profile?.role === 'master_ib' ? ibLinks :
		clientLinks
	);

	const roleLabel = $derived(
		profile?.role === 'admin' ? 'Admin' :
		profile?.role === 'master_ib' ? 'Master IB' :
		'Client'
	);
</script>

<!-- Mobile toggle -->
<button
	aria-label="Toggle navigation"
	class="md:hidden fixed top-4 left-4 z-50 p-2 bg-dark-surface border border-dark-border rounded-lg"
	onclick={() => mobileOpen = !mobileOpen}
>
	<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
	</svg>
</button>

<!-- Backdrop -->
{#if mobileOpen}
	<button
		aria-label="Close navigation"
		class="md:hidden fixed inset-0 bg-black/50 z-30"
		onclick={() => mobileOpen = false}
	></button>
{/if}

<!-- Sidebar -->
<aside class="
	fixed md:static z-40
	h-screen bg-dark-surface border-r border-dark-border
	flex flex-col
	transition-all duration-200
	{collapsed ? 'w-16' : 'w-64'}
	{mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
">
	<!-- Logo + Collapse toggle -->
	<div class="p-4 border-b border-dark-border flex items-center justify-between">
		{#if !collapsed}
			<div>
				<h1 class="text-lg font-bold text-white">IB Portal</h1>
				<p class="text-xs text-gray-500 mt-0.5">{roleLabel}</p>
			</div>
		{/if}
		<button
			aria-label={collapsed ? 'ขยาย Sidebar' : 'หุบ Sidebar'}
			class="hidden md:flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-white hover:bg-dark-hover transition-colors {collapsed ? 'mx-auto' : ''}"
			onclick={() => collapsed = !collapsed}
		>
			<svg class="w-4 h-4 transition-transform duration-200 {collapsed ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
		</button>
	</div>

	<!-- Navigation -->
	<nav class="p-3 space-y-1">
		{#each links as link}
			<a
				href={link.href}
				title={collapsed ? link.label : ''}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
					{collapsed ? 'justify-center' : ''}
					{(link.exact ? $page.url.pathname === link.href : $page.url.pathname === link.href || $page.url.pathname.startsWith(link.href + '/'))
						? 'bg-brand-600/10 text-brand-400 font-medium'
						: 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
				onclick={() => mobileOpen = false}
			>
				<span class="text-base">{link.icon}</span>
				{#if !collapsed}
					{link.label}
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Market news -->
	<div class="flex-1 overflow-hidden">
		<SidebarNews {collapsed} />
	</div>

	<!-- User info -->
	<div class="p-4 border-t border-dark-border">
		{#if collapsed}
			<div class="flex justify-center" title={profile?.full_name}>
				{#if profile?.avatar_url}
					<img src={profile.avatar_url} alt={profile.full_name} class="w-8 h-8 rounded-full object-cover" referrerpolicy="no-referrer" />
				{:else}
					<div class="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-sm font-medium">
						{profile?.full_name?.charAt(0) || '?'}
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex items-center gap-3">
				{#if profile?.avatar_url}
					<img src={profile.avatar_url} alt={profile.full_name} class="w-8 h-8 rounded-full object-cover" referrerpolicy="no-referrer" />
				{:else}
					<div class="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-sm font-medium">
						{profile?.full_name?.charAt(0) || '?'}
					</div>
				{/if}
				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-white truncate">{profile?.full_name}</p>
					<p class="text-xs text-gray-500 truncate">{profile?.email}</p>
				</div>
			</div>
			<form method="POST" action="/auth/logout" class="mt-3">
				<button type="submit" class="w-full text-left text-xs text-gray-500 hover:text-red-400 transition-colors">
					ออกจากระบบ
				</button>
			</form>
		{/if}
	</div>
</aside>
