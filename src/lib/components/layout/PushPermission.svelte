<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let show = $state(false);
	let loading = $state(false);

	interface Props {
		userId: string;
		vapidPublicKey: string;
	}

	let { userId, vapidPublicKey }: Props = $props();

	onMount(() => {
		if (!browser) return;
		if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
		if (!('PushManager' in window)) return;

		// Only show if permission not yet decided
		if (Notification.permission !== 'default') return;

		// Check if dismissed recently
		const dismissed = localStorage.getItem('push-permission-dismissed');
		if (dismissed) {
			const dismissedAt = parseInt(dismissed, 10);
			const thirtyDays = 30 * 24 * 60 * 60 * 1000;
			if (Date.now() - dismissedAt < thirtyDays) return;
		}

		// Show after a delay to not overwhelm the user
		setTimeout(() => {
			show = true;
		}, 5000);
	});

	function urlBase64ToUint8Array(base64String: string): Uint8Array {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}
		return outputArray;
	}

	async function subscribe() {
		loading = true;
		try {
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
			});

			// Send subscription to server
			await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					subscription: subscription.toJSON()
				})
			});

			show = false;
		} catch (err) {
			console.error('Push subscription failed:', err);
			show = false;
		} finally {
			loading = false;
		}
	}

	function dismiss() {
		show = false;
		localStorage.setItem('push-permission-dismissed', Date.now().toString());
	}
</script>

{#if show}
	<div class="fixed top-16 right-4 z-[80] animate-fade-in max-w-xs">
		<div class="bg-dark-surface border border-dark-border rounded-xl p-4 shadow-xl">
			<div class="flex items-start gap-3">
				<div class="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center shrink-0">
					<svg class="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="text-sm font-semibold text-white">เปิดการแจ้งเตือน</h3>
					<p class="text-xs text-gray-400 mt-1">รับแจ้งเตือนเมื่อมีการอัพเดทสำคัญ</p>
					<div class="flex gap-2 mt-3">
						<button
							onclick={subscribe}
							disabled={loading}
							class="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
						>
							{loading ? 'กำลังตั้งค่า...' : 'อนุญาต'}
						</button>
						<button
							onclick={dismiss}
							class="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
						>
							ไว้ทีหลัง
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(-0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.animate-fade-in {
		animation: fade-in 0.3s ease-out;
	}
</style>
