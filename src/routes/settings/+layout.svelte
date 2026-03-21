<script lang="ts">
	import { page } from '$app/stores';

	let { data, children } = $props();
	let { profile } = $derived(data);

	let mobileNavOpen = $state(false);

	const tabs = [
		{
			href: '/settings',
			label: 'โปรไฟล์',
			icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
			exact: true
		},
		{
			href: '/settings/security',
			label: 'ความปลอดภัย',
			icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
			exact: false
		},
		{
			href: '/settings/trade',
			label: 'ตั้งค่าเทรด',
			icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
			exact: false
		},
		{
			href: '/settings/alerts',
			label: 'การแจ้งเตือน',
			icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
			exact: false
		},
		{
			href: '/settings/email-reports',
			label: 'รายงานอีเมล',
			icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
			exact: false
		}
	];

	const isActive = (tab: typeof tabs[0]) => {
		const path = $page.url.pathname;
		if (tab.exact) return path === tab.href;
		return path.startsWith(tab.href);
	};
</script>

<svelte:head>
	<title>ตั้งค่า - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold">ตั้งค่า</h1>
	</div>

	<div class="flex flex-col md:flex-row gap-6">
		<!-- Mobile tab selector -->
		<div class="md:hidden">
			<button
				onclick={() => mobileNavOpen = !mobileNavOpen}
				class="w-full flex items-center justify-between rounded-lg border border-dark-border bg-dark-surface px-4 py-3 text-sm text-white"
			>
				<span>{tabs.find(t => isActive(t))?.label || 'เมนู'}</span>
				<svg
					class="w-4 h-4 text-gray-400 transition-transform {mobileNavOpen ? 'rotate-180' : ''}"
					fill="none" stroke="currentColor" viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{#if mobileNavOpen}
				<nav class="mt-1 rounded-lg border border-dark-border bg-dark-surface overflow-hidden">
					{#each tabs as tab}
						<a
							href={tab.href}
							onclick={() => mobileNavOpen = false}
							class="flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-dark-border last:border-b-0
								{isActive(tab)
									? 'bg-brand-primary/10 text-brand-primary'
									: 'text-gray-400 hover:text-white hover:bg-dark-hover'}"
						>
							<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={tab.icon} />
							</svg>
							{tab.label}
						</a>
					{/each}
				</nav>
			{/if}
		</div>

		<!-- Desktop sidebar nav -->
		<aside class="hidden md:block w-56 shrink-0">
			<nav class="rounded-xl border border-dark-border bg-dark-surface overflow-hidden">
				<!-- User info card -->
				<div class="p-4 border-b border-dark-border">
					<div class="flex items-center gap-3">
						{#if profile?.avatar_url}
							<img
								src={profile.avatar_url}
								alt={profile.full_name}
								class="w-10 h-10 rounded-full object-cover"
								referrerpolicy="no-referrer"
							/>
						{:else}
							<div class="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary text-sm font-bold">
								{profile?.full_name?.charAt(0) || '?'}
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-white truncate">{profile?.full_name}</p>
							<p class="text-xs text-gray-500 truncate">{profile?.email}</p>
						</div>
					</div>
				</div>

				<!-- Nav links -->
				{#each tabs as tab}
					<a
						href={tab.href}
						class="flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-dark-border last:border-b-0
							{isActive(tab)
								? 'bg-brand-primary/10 text-brand-primary border-l-2 border-l-brand-primary'
								: 'text-gray-400 hover:text-white hover:bg-dark-hover border-l-2 border-l-transparent'}"
					>
						<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={tab.icon} />
						</svg>
						{tab.label}
					</a>
				{/each}
			</nav>
		</aside>

		<!-- Content area -->
		<div class="flex-1 min-w-0">
			{@render children()}
		</div>
	</div>
</div>
