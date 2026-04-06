<script lang="ts">
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';
	import SidebarNews from './SidebarNews.svelte';

	let { profile, collapsed = $bindable(false) } = $props();

	let mobileOpen = $state(false);

	// SVG icon paths (Heroicons outline style, viewBox 0 0 24 24)
	const icons = {
		home: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
		userCheck: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
		users: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>',
		academicCap: '<path d="M12 14l9-5-9-5-9 5 9 5z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"/>',
		chartBar: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>',
		userCircle: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
		userPlus: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>',
		calendarDays: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
		listBullet: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
		pencilSquare: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>',
		trendingUp: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
		bookOpen: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>',
		trophy: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>',
		documentText: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
		liveSignal: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>',
		sparkles: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>',
		userGroup: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>',
	};

	const adminLinks = [
		{ href: '/admin', label: 'Dashboard', icon: icons.home, exact: true },
		{ href: '/admin/approvals', label: 'อนุมัติลูกค้า', icon: icons.userCheck, exact: false },
		{ href: '/admin/ibs', label: 'Master IBs', icon: icons.users, exact: false },
		{ href: '/admin/coaches', label: 'จัดการโค้ช', icon: icons.academicCap, exact: false },
	];

	const ibLinks = [
		{ href: '/ib', label: 'Dashboard', icon: icons.home, exact: true },
		{ href: '/ib/clients', label: 'ลูกค้าของฉัน', icon: icons.userCircle, exact: false },
		{ href: '/ib/clients/add', label: 'เพิ่มลูกค้า', icon: icons.userPlus, exact: false },
	];

	const clientLinks = [
		{ href: '/portfolio', label: 'พอร์ตของฉัน', icon: icons.chartBar, exact: false },
	];

	const portfolioSubLinks = [
		{ href: '/portfolio', label: 'ภาพรวม', icon: icons.home, exact: true },
		{ href: '/portfolio/day-view', label: 'Day View', icon: icons.calendarDays, exact: false },
		{ href: '/portfolio/trades', label: 'Trades', icon: icons.listBullet, exact: false },
		{ href: '/portfolio/journal', label: 'Journal', icon: icons.pencilSquare, exact: false },
		{ href: '/portfolio/notebook', label: 'Notebook', icon: icons.documentText, exact: false },
		{ href: '/portfolio/analytics', label: 'Analytics', icon: icons.trendingUp, exact: false },
		{ href: '/portfolio/playbook', label: 'Playbook', icon: icons.bookOpen, exact: false },
		{ href: '/portfolio/progress', label: 'Progress', icon: icons.trophy, exact: false },
		{ href: '/portfolio/calendar', label: 'ปฏิทิน', icon: icons.calendarDays, exact: false },
		{ href: '/portfolio/live-trade', label: 'เทรดสด', icon: icons.liveSignal, exact: false },
		{ href: '/portfolio/analysis', label: 'วิเคราะห์ทอง', icon: icons.sparkles, exact: false },
	];

	const links = $derived(
		profile?.role === 'admin' ? adminLinks :
		profile?.role === 'master_ib' ? ibLinks :
		clientLinks
	);

	const currentPath = $derived($page.url.pathname);
	const isInPortfolio = $derived(currentPath.startsWith('/portfolio'));

	// Preserve account_id in sidebar links so afterNavigate doesn't have to re-navigate
	const accountIdParam = $derived($page.url.searchParams.get('account_id'));
	const withAccountId = (href: string) => accountIdParam ? `${href}?account_id=${accountIdParam}` : href;

	// Pre-compute active states once per navigation (avoid re-evaluating in each link's class expression)
	const activeSubLink = $derived(
		portfolioSubLinks.find(s => s.exact ? currentPath === s.href : currentPath.startsWith(s.href))?.href ?? ''
	);
	const activeMainLink = $derived(
		links.find(l => l.exact ? currentPath === l.href : currentPath === l.href || currentPath.startsWith(l.href + '/'))?.href ?? ''
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
		transition:fade={{ duration: 200 }}
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
				<p class="text-xs text-gray-400 mt-0.5">{roleLabel}</p>
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
	<nav class="p-3 space-y-0.5">
		{#each links as link}
			<a
				href={link.href.startsWith('/portfolio') ? withAccountId(link.href) : link.href}
				title={collapsed ? link.label : ''}
				class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
					{collapsed ? 'justify-center' : ''}
					{activeMainLink === link.href
						? 'bg-brand-600/10 text-brand-400 font-medium'
						: 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
				onclick={() => mobileOpen = false}
			>
				<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">{@html link.icon}</svg>
				{#if !collapsed}
					{link.label}
				{/if}
			</a>
		{/each}

		<!-- Portfolio sub-navigation (client role only, when in /portfolio) -->
		{#if isInPortfolio && profile?.role === 'client'}
			<div class="pt-1 {collapsed ? '' : 'pl-2 border-l border-dark-border ml-4'}">
				{#each portfolioSubLinks as sub}
					<a
						href={withAccountId(sub.href)}
						title={collapsed ? sub.label : ''}
						class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors
							{collapsed ? 'justify-center' : ''}
							{activeSubLink === sub.href
								? 'text-brand-400 font-medium bg-brand-600/10'
								: 'text-gray-500 hover:text-gray-300 hover:bg-dark-hover'}"
						onclick={() => mobileOpen = false}
					>
						<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">{@html sub.icon}</svg>
						{#if !collapsed}
							{sub.label}
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</nav>

	<!-- Settings link (all roles) -->
	<div class="px-3 mt-1 pt-2 border-t border-dark-border">
		<a
			href="/settings"
			title={collapsed ? 'ตั้งค่า' : ''}
			class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
				{collapsed ? 'justify-center' : ''}
				{currentPath.startsWith('/settings')
					? 'bg-brand-600/10 text-brand-400 font-medium'
					: 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
			onclick={() => mobileOpen = false}
		>
			<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
			{#if !collapsed}
				ตั้งค่า
			{/if}
		</a>
	</div>

	<!-- Market news -->
	<div class="flex-1 overflow-hidden">
		<SidebarNews {collapsed} />
	</div>

	<!-- User info -->
	<div class="p-4 border-t border-dark-border">
		{#if collapsed}
			<div class="flex justify-center" title={profile?.full_name}>
				{#if profile?.avatar_url}
					<img src={profile.avatar_url} alt={profile.full_name} width="32" height="32" class="w-8 h-8 rounded-full object-cover" referrerpolicy="no-referrer" />
				{:else}
					<div class="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-sm font-medium">
						{profile?.full_name?.charAt(0) || '?'}
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex items-center gap-3">
				{#if profile?.avatar_url}
					<img src={profile.avatar_url} alt={profile.full_name} width="32" height="32" class="w-8 h-8 rounded-full object-cover" referrerpolicy="no-referrer" />
				{:else}
					<div class="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-sm font-medium">
						{profile?.full_name?.charAt(0) || '?'}
					</div>
				{/if}
				<div class="flex-1 min-w-0">
					<p class="text-sm font-medium text-white truncate">{profile?.full_name}</p>
					<p class="text-xs text-gray-400 truncate">{profile?.email}</p>
				</div>
			</div>
			<form method="POST" action="/auth/logout" class="mt-3">
				<button type="submit" class="w-full text-left text-xs text-gray-400 hover:text-red-400 transition-colors">
					ออกจากระบบ
				</button>
			</form>
		{/if}
	</div>
</aside>
