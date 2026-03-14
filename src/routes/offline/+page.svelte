<svelte:head>
	<title>ออฟไลน์ - IB Portal</title>
</svelte:head>

<div class="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
	<div class="text-center max-w-sm">
		<div class="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#1e3a5f] flex items-center justify-center">
			<svg class="w-10 h-10 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 010 7.072M15.536 8.464a5 5 0 000 7.072M12 12h.01" />
			</svg>
		</div>

		<h1 class="text-2xl font-bold text-white mb-2">คุณกำลังออฟไลน์</h1>
		<p class="text-gray-400 mb-8">ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p>

		<button
			onclick={() => window.location.reload()}
			class="inline-flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium py-3 px-6 rounded-lg transition-colors"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
			ลองอีกครั้ง
		</button>
	</div>
</div>
