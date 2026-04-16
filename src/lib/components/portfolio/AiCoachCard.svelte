<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	function buildHref(mode: 'coach' | 'portfolio', starter?: string): string {
		const params = new URLSearchParams();
		const accountId = $page.url.searchParams.get('account_id');
		if (accountId) params.set('account_id', accountId);
		params.set('mode', mode);
		if (starter) params.set('starter', starter);
		return `/portfolio/ai?${params.toString()}`;
	}
</script>

<div class="card">
	<!-- Header -->
	<div class="flex items-start justify-between gap-3">
		<div class="flex items-center gap-3">
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary">
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423L16.5 15.75l.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
				</svg>
			</div>
			<div>
				<p class="text-[10px] uppercase tracking-[0.24em] text-gray-400">Unified AI</p>
				<h2 class="text-base font-semibold text-white">AI ผู้ช่วยเทรด</h2>
			</div>
		</div>
		<a
			href={buildHref('coach')}
			class="flex shrink-0 items-center gap-1.5 rounded-lg border border-dark-border px-2.5 py-1.5 text-[11px] text-gray-400 transition-colors hover:border-brand-primary/40 hover:text-white"
		>
			เปิด TradePilot
		</a>
	</div>

	<div class="mt-4">
		<div class="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3">
			<p class="text-sm leading-relaxed text-gray-200">
				จากนี้ AI ทุกแบบจะถูกรวมใน TradePilot ตัวเดียว คุณถามได้ทั้ง performance, trades, journal, playbook, coaching และบริบททองคำ โดยใช้ account ปัจจุบันเป็น scope หลัก
			</p>
		</div>

		<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
			<button
				class="rounded-lg border border-dark-border bg-dark-bg/40 px-3 py-3 text-left text-sm text-gray-300 transition-colors hover:border-brand-primary/40 hover:text-white"
				onclick={() => goto(buildHref('coach', 'ช่วยสรุป recurring mistakes จาก trades และ reviews ล่าสุด'))}
			>
				<div class="text-[10px] uppercase tracking-wide text-gray-500">Coach</div>
				<div class="mt-1 font-medium text-white">สรุป recurring mistakes</div>
			</button>
			<button
				class="rounded-lg border border-dark-border bg-dark-bg/40 px-3 py-3 text-left text-sm text-gray-300 transition-colors hover:border-brand-primary/40 hover:text-white"
				onclick={() => goto(buildHref('portfolio', 'สรุปผลงานการเทรด 7 วันล่าสุดให้หน่อย'))}
			>
				<div class="text-[10px] uppercase tracking-wide text-gray-500">Portfolio</div>
				<div class="mt-1 font-medium text-white">สรุปผลงาน 7 วันล่าสุด</div>
			</button>
		</div>

		<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-dark-border pt-3 text-[11px] text-gray-400">
			<span class="rounded-full border border-dark-border px-2.5 py-1">One AI surface</span>
			<span class="rounded-full border border-dark-border px-2.5 py-1">Scoped by current account</span>
			<span class="rounded-full border border-dark-border px-2.5 py-1">Coach + Gold + Q&A</span>
		</div>
	</div>
</div>
