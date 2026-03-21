<script lang="ts">
	import { onMount } from 'svelte';

	interface CoachInsight {
		category: 'session' | 'time' | 'setup' | 'behavior';
		title: string;
		value: string;
		sentiment: 'positive' | 'negative' | 'neutral';
	}

	interface CoachData {
		message: string;
		insights: CoachInsight[];
		generatedAt: string;
		stats: { totalTrades: number; winRate: number; profitFactor: number };
	}

	const CACHE_KEY = 'ai-coach-v1';
	const CACHE_TTL = 24 * 60 * 60 * 1000;

	let coach = $state<CoachData | null>(null);
	let loading = $state(false);
	let error = $state('');
	let insufficientData = $state(false);

	function getToday(): string {
		return new Date().toISOString().split('T')[0];
	}

	function loadFromCache(): CoachData | null {
		try {
			const raw = localStorage.getItem(CACHE_KEY);
			if (!raw) return null;
			const cached: { date: string; cachedAt: string; data: CoachData } = JSON.parse(raw);
			if (cached.date !== getToday()) return null;
			if (Date.now() - new Date(cached.cachedAt).getTime() > CACHE_TTL) return null;
			return cached.data;
		} catch {
			return null;
		}
	}

	function saveToCache(data: CoachData): void {
		try {
			localStorage.setItem(
				CACHE_KEY,
				JSON.stringify({ date: getToday(), cachedAt: new Date().toISOString(), data })
			);
		} catch {
			// ignore storage errors
		}
	}

	async function fetchCoach(force = false): Promise<void> {
		if (!force) {
			const cached = loadFromCache();
			if (cached) {
				coach = cached;
				return;
			}
		}
		loading = true;
		error = '';
		insufficientData = false;
		try {
			const res = await fetch('/api/portfolio/ai-coach', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) {
				error = typeof data.message === 'string' ? data.message : 'เกิดข้อผิดพลาด';
				return;
			}
			if (data.reason === 'insufficient_data') {
				insufficientData = true;
				return;
			}
			if (data.coach) {
				coach = data.coach as CoachData;
				saveToCache(data.coach as CoachData);
			}
		} catch {
			error = 'ไม่สามารถเชื่อมต่อได้';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchCoach(false);
	});

	function sentimentClasses(s: string): string {
		if (s === 'positive') return 'border-green-500/20 bg-green-500/10 text-green-300';
		if (s === 'negative') return 'border-red-500/20 bg-red-500/10 text-red-300';
		return 'border-dark-border bg-dark-bg/30 text-gray-400';
	}

	function sentimentDot(s: string): string {
		if (s === 'positive') return 'bg-green-400';
		if (s === 'negative') return 'bg-red-400';
		return 'bg-gray-500';
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
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
				<p class="text-[10px] uppercase tracking-[0.24em] text-gray-500">AI Coach</p>
				<h2 class="text-base font-semibold text-white">คำแนะนำส่วนตัว</h2>
			</div>
		</div>
		<div class="flex items-center gap-2 shrink-0">
			{#if coach}
				<span class="text-[10px] text-gray-600">อัปเดต {formatTime(coach.generatedAt)}</span>
			{/if}
			<button
				onclick={() => fetchCoach(true)}
				disabled={loading}
				class="flex items-center gap-1.5 rounded-lg border border-dark-border px-2.5 py-1.5 text-[11px] text-gray-400 transition-colors hover:border-brand-primary/40 hover:text-white disabled:opacity-50"
				aria-label="สร้างคำแนะนำใหม่"
			>
				{#if loading}
					<svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					กำลังวิเคราะห์...
				{:else}
					<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
					</svg>
					สร้างใหม่
				{/if}
			</button>
		</div>
	</div>

	<div class="mt-4">
		{#if loading && !coach}
			<!-- Loading skeleton -->
			<div class="animate-pulse space-y-3">
				<div class="h-4 w-full rounded bg-dark-border/30"></div>
				<div class="h-4 w-4/5 rounded bg-dark-border/30"></div>
				<div class="mt-4 grid grid-cols-2 gap-2">
					{#each [1, 2, 3, 4] as _}
						<div class="h-14 rounded-lg bg-dark-border/20"></div>
					{/each}
				</div>
				<div class="mt-3 h-3 w-1/3 rounded bg-dark-border/50"></div>
			</div>
		{:else if error}
			<div class="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
				{error}
			</div>
		{:else if insufficientData}
			<div class="rounded-xl border border-dashed border-dark-border px-4 py-8 text-center">
				<svg class="mx-auto h-8 w-8 text-gray-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
				</svg>
				<p class="text-sm text-gray-400">ต้องการข้อมูลเทรดอย่างน้อย 5 รายการใน 30 วันล่าสุด</p>
				<p class="mt-1 text-xs text-gray-600">เพิ่มเทรดและลองใหม่อีกครั้ง</p>
			</div>
		{:else if !coach}
			<div class="rounded-xl border border-dashed border-dark-border px-4 py-8 text-center">
				<svg class="mx-auto h-8 w-8 text-gray-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
				</svg>
				<p class="text-sm text-gray-400">กดปุ่ม "สร้างใหม่" เพื่อรับคำแนะนำจาก AI Coach</p>
				<p class="mt-1 text-xs text-gray-600">วิเคราะห์จากเทรด 30 วันล่าสุดของคุณ</p>
			</div>
		{:else}
			<!-- Main coaching message -->
			<div class="rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-3">
				<p class="text-sm leading-relaxed text-gray-200">{coach.message}</p>
			</div>

			<!-- Insight chips -->
			{#if coach.insights && coach.insights.length > 0}
				<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each coach.insights as insight}
						<div class="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 {sentimentClasses(insight.sentiment)}">
							<div class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full {sentimentDot(insight.sentiment)}"></div>
							<div class="min-w-0">
								<div class="text-[10px] uppercase tracking-wide opacity-60">{insight.title}</div>
								<div class="mt-0.5 text-xs font-medium leading-snug">{insight.value}</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Stats footer -->
			<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dark-border pt-3 text-[11px] text-gray-600">
				<span>วิเคราะห์จาก <span class="text-gray-500">{coach.stats.totalTrades}</span> เทรด</span>
				<span>Win Rate <span class="text-gray-500">{coach.stats.winRate.toFixed(1)}%</span></span>
				<span>Profit Factor <span class="text-gray-500">{coach.stats.profitFactor > 0 ? coach.stats.profitFactor.toFixed(2) : '∞'}</span></span>
				<span class="ml-auto text-gray-700">ข้อมูล 30 วันล่าสุด</span>
			</div>
		{/if}
	</div>
</div>
