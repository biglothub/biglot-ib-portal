<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { timeAgo } from '$lib/utils';
	import type { Notification } from '$lib/types';

	let { userId }: { userId: string } = $props();

	let notifications = $state<Notification[]>([]);
	let open = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let unreadCount = $derived(notifications.filter(n => !n.is_read).length);

	async function fetchNotifications() {
		loading = true;
		error = null;
		try {
			const { data, error: fetchError } = await supabase
				.from('notifications')
				.select('*')
				.eq('user_id', userId)
				.order('created_at', { ascending: false })
				.limit(20);

			if (fetchError) throw fetchError;
			notifications = data ?? [];
		} catch (e) {
			error = 'ไม่สามารถโหลดการแจ้งเตือนได้';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		fetchNotifications();

		// Realtime subscription
		const channel = supabase
			.channel('user-notifications')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'notifications',
					filter: `user_id=eq.${userId}`
				},
				(payload) => {
					notifications = [payload.new as Notification, ...notifications];
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});

	async function markAsRead(id: string) {
		try {
			const { error: updateError } = await supabase
				.from('notifications')
				.update({ is_read: true })
				.eq('id', id);

			if (updateError) throw updateError;
			notifications = notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
		} catch {
			// Silently fail — notification stays visually unread
		}
	}

	async function markAllAsRead() {
		const previousNotifications = [...notifications];
		// Optimistic update
		notifications = notifications.map(n => ({ ...n, is_read: true }));
		try {
			const { error: updateError } = await supabase
				.from('notifications')
				.update({ is_read: true })
				.eq('user_id', userId)
				.eq('is_read', false);

			if (updateError) throw updateError;
		} catch {
			// Rollback on failure
			notifications = previousNotifications;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.notification-bell')) {
			open = false;
		}
	}
</script>

<svelte:window onclick={open ? handleClickOutside : undefined} />

<div class="notification-bell relative">
	<button
		class="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors"
		onclick={(e) => { e.stopPropagation(); open = !open; }}
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
				d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
		</svg>
		{#if unreadCount > 0}
			<span class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium">
				{unreadCount > 9 ? '9+' : unreadCount}
			</span>
		{/if}
	</button>

	{#if open}
		<div class="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50">
			<div class="flex items-center justify-between p-3 border-b border-dark-border">
				<span class="text-sm font-medium text-white">การแจ้งเตือน</span>
				{#if unreadCount > 0}
					<button class="text-xs text-brand-400 hover:text-brand-300" onclick={markAllAsRead}>
						อ่านทั้งหมด
					</button>
				{/if}
			</div>
			{#if loading}
				<div class="p-4 space-y-3">
					{#each Array(3) as _}
						<div class="flex items-start gap-2 animate-pulse">
							<div class="w-2 h-2 rounded-full bg-dark-border/50 mt-1.5 shrink-0"></div>
							<div class="flex-1 space-y-1.5">
								<div class="h-3.5 bg-dark-border/50 rounded w-3/4"></div>
								<div class="h-3 bg-dark-border/30 rounded w-1/2"></div>
							</div>
						</div>
					{/each}
				</div>
			{:else if error}
				<div class="p-6 text-center">
					<p class="text-sm text-red-400 mb-2">{error}</p>
					<button
						class="text-xs text-brand-400 hover:text-brand-300 transition-colors"
						onclick={fetchNotifications}
					>
						ลองใหม่อีกครั้ง
					</button>
				</div>
			{:else if notifications.length === 0}
				<div class="flex flex-col items-center justify-center py-8 text-gray-500">
					<svg class="w-8 h-8 mb-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
					</svg>
					<p class="text-sm">ไม่มีการแจ้งเตือน</p>
				</div>
			{:else}
				{#each notifications as notif}
					<button
						class="w-full text-left p-3 border-b border-dark-border/50 hover:bg-dark-hover transition-colors
							{!notif.is_read ? 'bg-brand-600/5' : ''}"
						onclick={() => { if (!notif.is_read) markAsRead(notif.id); }}
					>
						<div class="flex items-start gap-2">
							{#if !notif.is_read}
								<span class="w-2 h-2 rounded-full bg-brand-400 mt-1.5 shrink-0"></span>
							{:else}
								<span class="w-2 h-2 shrink-0"></span>
							{/if}
							<div class="flex-1 min-w-0">
								<p class="text-sm text-white">{notif.title}</p>
								{#if notif.body}
									<p class="text-xs text-gray-500 mt-0.5 truncate">{notif.body}</p>
								{/if}
								<p class="text-xs text-gray-600 mt-1">{timeAgo(notif.created_at)}</p>
							</div>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>
