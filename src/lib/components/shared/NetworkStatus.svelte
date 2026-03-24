<script lang="ts">
	import { invalidate } from '$app/navigation'

	let online = $state(true)
	let justReconnected = $state(false)
	let reconnectedTimer: ReturnType<typeof setTimeout> | null = null

	$effect(() => {
		online = navigator.onLine

		function handleOffline() {
			online = false
		}

		async function handleOnline() {
			online = true
			justReconnected = true
			if (reconnectedTimer) clearTimeout(reconnectedTimer)
			reconnectedTimer = setTimeout(() => {
				justReconnected = false
			}, 3000)
			await invalidate('portfolio:baseData')
		}

		window.addEventListener('offline', handleOffline)
		window.addEventListener('online', handleOnline)

		return () => {
			window.removeEventListener('offline', handleOffline)
			window.removeEventListener('online', handleOnline)
			if (reconnectedTimer) clearTimeout(reconnectedTimer)
		}
	})
</script>

{#if !online}
	<div
		class="fixed top-0 inset-x-0 z-50 bg-red-900/90 border-b border-red-700/60 px-4 py-2 flex items-center justify-center gap-2"
		role="status"
		aria-live="polite"
	>
		<!-- Wifi-off icon -->
		<svg class="w-4 h-4 text-red-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<line x1="2" y1="2" x2="22" y2="22" stroke-linecap="round" stroke-width="2" />
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.5 16.5a5 5 0 017 0M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M12 20h.01" />
		</svg>
		<span class="text-xs text-red-200">
			ไม่มีการเชื่อมต่ออินเทอร์เน็ต — การเปลี่ยนแปลงจะถูกบันทึกเมื่อเชื่อมต่อแล้ว
		</span>
	</div>
{/if}

{#if justReconnected}
	<div
		class="fixed bottom-24 md:bottom-8 right-4 z-50 flex items-center gap-2 bg-dark-surface border border-green-500/30 rounded-full px-4 py-2 shadow-lg"
		role="status"
		aria-live="polite"
	>
		<span class="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0"></span>
		<span class="text-xs text-green-400 font-medium whitespace-nowrap">เชื่อมต่อแล้ว</span>
	</div>
{/if}
