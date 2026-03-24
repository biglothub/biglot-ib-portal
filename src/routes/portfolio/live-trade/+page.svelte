<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const coaches = $derived(data.coaches);

	function getBangkokHour(): number {
		const now = new Date();
		return ((now.getUTCHours() + 7) % 24) + now.getUTCMinutes() / 60;
	}

	function getBangkokTimeString(): string {
		const now = new Date();
		const h = Math.floor(((now.getUTCHours() + 7) % 24));
		const m = now.getUTCMinutes().toString().padStart(2, '0');
		return `${h.toString().padStart(2, '0')}:${m}`;
	}

	function isLive(startHour: number, endHour: number): boolean {
		const now = getBangkokHour();
		if (endHour > 24) {
			return now >= startHour || now < endHour - 24;
		}
		return now >= startHour && now < endHour;
	}

	let tick = $state(0);

	onMount(() => {
		const id = setInterval(() => tick++, 30000);
		return () => clearInterval(id);
	});

	let currentTime = $derived.by(() => {
		void tick;
		return getBangkokTimeString();
	});

	let liveCoachIndex = $derived.by(() => {
		void tick;
		return coaches.findIndex((c) => isLive(c.start_hour, c.end_hour));
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-bold text-white">ELITE GOLD LIVE TRADE</h2>
			<p class="text-xs text-gray-400 mt-1">ตาราง Live Trade Master ประจำวัน</p>
		</div>
		<div class="flex items-center gap-3">
			{#if liveCoachIndex >= 0}
				<div class="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5">
					<span class="relative flex h-2.5 w-2.5">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
					</span>
					<span class="text-xs text-green-400 font-medium">LIVE</span>
				</div>
			{/if}
			<!-- Current time -->
			<div class="rounded-lg bg-dark-surface border border-dark-border px-3 py-1.5 text-center">
				<div class="text-lg font-mono font-bold text-white tracking-wider">{currentTime}</div>
				<div class="text-[9px] text-gray-400 -mt-0.5">เวลากรุงเทพฯ</div>
			</div>
		</div>
	</div>

	<!-- Coach list -->
	{#if coaches.length === 0}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<div class="w-16 h-16 rounded-2xl bg-dark-surface border border-dark-border flex items-center justify-center mb-4">
				<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
				</svg>
			</div>
			<h3 class="text-sm font-medium text-gray-400 mb-1">ยังไม่มีตารางโค้ช</h3>
			<p class="text-xs text-gray-400 max-w-xs">ตาราง Live Trade จะแสดงเมื่อแอดมินเพิ่มข้อมูลโค้ชในระบบ</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each coaches as coach, i}
				{@const live = i === liveCoachIndex}
				<div
					class="live-card relative rounded-2xl border transition-all duration-500
						{live
							? `${coach.color_border} ${coach.color_bg}`
							: 'border-dark-border bg-dark-surface hover:bg-dark-hover'}"
					style={live ? `--glow-rgb: ${coach.glow_rgb}` : ''}
					class:is-live={live}
				>
					{#if live}
						<div class="absolute -top-2.5 right-4">
							<span class="inline-flex items-center gap-1.5 rounded-full bg-green-500 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
								<span class="relative flex h-1.5 w-1.5">
									<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
									<span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
								</span>
								Live
							</span>
						</div>
					{/if}

					<div class="flex items-center gap-4 p-4">
						<!-- Coach badge -->
						<div class="flex-shrink-0 w-28">
							<div class="rounded-xl bg-gradient-to-r {coach.color_gradient} px-3 py-2 text-center">
								<div class="text-[10px] font-bold text-white tracking-wider">{coach.name}</div>
								<div class="text-[10px] text-white/80">{coach.time_display}</div>
							</div>
						</div>

						<!-- Avatar -->
						<div class="flex-shrink-0 relative">
							{#if live}
								<div class="absolute -inset-1 rounded-full animate-pulse-ring" style="background: rgba({coach.glow_rgb}, 0.25)"></div>
							{/if}
							{#if coach.avatar_url}
								<img
									src={coach.avatar_url}
									alt={coach.name}
									width="44"
									height="44"
									loading="lazy"
									class="relative w-11 h-11 rounded-full object-cover border-2 transition-all duration-500
										{live ? coach.color_border : 'border-dark-border'}"
								/>
							{:else}
								<div class="relative w-11 h-11 rounded-full border-2 flex items-center justify-center bg-dark-surface transition-all duration-500
									{live ? coach.color_border : 'border-dark-border'}">
									<span class="text-xs font-bold text-gray-400">{coach.name.charAt(6) || '?'}</span>
								</div>
							{/if}
						</div>

						<!-- Channel info -->
						<div class="flex-1 min-w-0">
							<h3 class="text-sm font-semibold truncate transition-colors duration-500 {live ? 'text-white' : 'text-gray-300'}">{coach.channel_name}</h3>
							<a
								href="https://www.youtube.com/{coach.youtube_handle}"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 mt-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
							>
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
									<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
								</svg>
								{coach.youtube_handle}
							</a>
						</div>

						<!-- Time display -->
						<div class="flex-shrink-0 text-right hidden sm:block">
							<div class="text-sm font-mono transition-colors duration-500 {live ? coach.color_text : 'text-gray-400'}">
								{coach.time_display}
							</div>
							{#if live}
								<div class="text-[10px] {coach.color_text} mt-0.5 font-medium">กำลัง Live</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Glow pulse on the live card border */
	.live-card.is-live {
		animation: card-glow 2.5s ease-in-out infinite;
	}

	@keyframes card-glow {
		0%, 100% {
			box-shadow:
				0 0 8px 0 rgba(var(--glow-rgb), 0.15),
				0 0 20px -4px rgba(var(--glow-rgb), 0.1);
		}
		50% {
			box-shadow:
				0 0 16px 2px rgba(var(--glow-rgb), 0.3),
				0 0 40px -4px rgba(var(--glow-rgb), 0.2);
		}
	}

	/* Pulse ring around the live avatar */
	.animate-pulse-ring {
		animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse-ring {
		0%, 100% { opacity: 0.5; transform: scale(1); }
		50%      { opacity: 0;   transform: scale(1.35); }
	}
</style>
