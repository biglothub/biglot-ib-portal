<script lang="ts">
	import { page } from '$app/stores';

	let { profile } = $props();

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
		{ href: '/portfolio', label: 'พอร์ตของฉัน', icon: '📈', exact: true },
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
	h-screen w-64 bg-dark-surface border-r border-dark-border
	flex flex-col
	transition-transform duration-200
	{mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
">
	<!-- Logo -->
	<div class="p-4 border-b border-dark-border">
		<h1 class="text-lg font-bold text-white">IB Portal</h1>
		<p class="text-xs text-gray-500 mt-0.5">{roleLabel}</p>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 p-3 space-y-1 overflow-y-auto">
		{#each links as link}
			<a
				href={link.href}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
					{(link.exact ? $page.url.pathname === link.href : $page.url.pathname === link.href || $page.url.pathname.startsWith(link.href + '/'))
						? 'bg-brand-600/10 text-brand-400 font-medium'
						: 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
				onclick={() => mobileOpen = false}
			>
				<span class="text-base">{link.icon}</span>
				{link.label}
			</a>
		{/each}
	</nav>

	<!-- User info -->
	<div class="p-4 border-t border-dark-border">
		<div class="flex items-center gap-3">
			<div class="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-sm font-medium">
				{profile?.full_name?.charAt(0) || '?'}
			</div>
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
	</div>
</aside>
