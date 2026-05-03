<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	let lastRoute = $state('/portfolio');
	let checking = $state(false);
	let checkFailed = $state(false);

	$effect(() => {
		if (!browser) return;
		const stored = localStorage.getItem('pwa.lastRoute');
		if (stored && stored.startsWith('/')) {
			lastRoute = stored;
		}
	});

	async function retryConnection() {
		checking = true;
		checkFailed = false;
		try {
			const response = await fetch('/api/health', { cache: 'no-store' });
			if (response.ok || response.status === 503) {
				await goto(lastRoute || '/portfolio');
				return;
			}
			checkFailed = true;
		} catch {
			checkFailed = true;
		} finally {
			checking = false;
		}
	}
</script>

<svelte:head>
	<title>ออฟไลน์ - IB Portal</title>
</svelte:head>

<div class="min-h-screen bg-dark-bg flex items-center justify-center p-4">
	<div class="text-center max-w-sm w-full">
		<!-- Icon -->
		<div class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-dark-surface border border-dark-border flex items-center justify-center">
			<svg class="w-10 h-10 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
					d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 010 7.072M15.536 8.464a5 5 0 000 7.072M12 12h.01" />
				<line x1="4" y1="4" x2="20" y2="20" stroke-linecap="round" stroke-width="1.5" />
			</svg>
		</div>

		<h1 class="text-2xl font-bold text-white mb-2">ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
		<p class="text-gray-400 mb-1 leading-relaxed">
			ขณะนี้คุณกำลังออฟไลน์อยู่
		</p>
		<p class="text-sm text-gray-400 mb-8">
			กลับไปหน้าล่าสุดหรือเปิดพอร์ตเพื่อดูข้อมูลที่บันทึกไว้
		</p>

		<!-- Actions -->
		<div class="flex flex-col gap-3 mb-8">
			<button
				onclick={() => goto(lastRoute || '/portfolio')}
				class="btn-primary inline-flex items-center justify-center gap-2 py-2.5 px-6"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
				กลับไปหน้าล่าสุด
			</button>
			<button
				onclick={retryConnection}
				disabled={checking}
				class="btn-secondary inline-flex items-center justify-center gap-2 py-2.5 px-6"
			>
				<svg class="w-4 h-4 {checking ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
				{checking ? 'กำลังตรวจสอบ...' : 'ลองเชื่อมต่อใหม่'}
			</button>
			<a
				href="/portfolio"
				class="btn-secondary inline-flex items-center justify-center gap-2 py-2.5 px-6"
			>
				เปิดหน้าพอร์ต
			</a>
		</div>

		{#if checkFailed}
			<p class="-mt-4 mb-6 text-xs text-red-400" role="status" aria-live="polite">
				ยังเชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้ง
			</p>
		{/if}

		<!-- What you can do offline -->
		<div class="p-4 rounded-xl bg-dark-surface border border-dark-border text-left">
			<p class="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">สิ่งที่ทำได้ขณะออฟไลน์</p>
			<ul class="space-y-2">
				{#each ['ดูข้อมูลพอร์ตที่บันทึกไว้ล่าสุด', 'อ่านบันทึกประจำวันและโน้ต', 'ตรวจสอบประวัติการเทรด', 'ดูสถิติและรายงาน'] as tip}
					<li class="flex items-center gap-2.5 text-sm text-gray-400">
						<svg class="w-3.5 h-3.5 text-brand-primary shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
						{tip}
					</li>
				{/each}
			</ul>
		</div>
	</div>
</div>
