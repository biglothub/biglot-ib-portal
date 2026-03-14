<script lang="ts">
	import { onMount } from 'svelte';

	const coaches = [
		{
			name: 'COACH PING',
			time: '05:00-07:00',
			startHour: 5,
			endHour: 7,
			channel: 'Gold with Ping',
			color: 'from-pink-500 to-rose-400',
			colorBorder: 'border-pink-500/30',
			colorText: 'text-pink-400',
			colorBg: 'bg-pink-500/10',
			youtube: '@goldwithping',
			avatar: '/coaches/ping.png',
			glow: '236,72,153'
		},
		{
			name: 'COACH BALL',
			time: '07:00-10:00',
			startHour: 7,
			endHour: 10,
			channel: 'Trader10X',
			color: 'from-orange-500 to-amber-400',
			colorBorder: 'border-orange-500/30',
			colorText: 'text-orange-400',
			colorBg: 'bg-orange-500/10',
			youtube: '@trader10-x',
			avatar: '/coaches/ball.png',
			glow: '249,115,22'
		},
		{
			name: 'COACH PU',
			time: '10:00-12:00',
			startHour: 10,
			endHour: 12,
			channel: 'Pu MoneyMind',
			color: 'from-yellow-500 to-amber-300',
			colorBorder: 'border-yellow-500/30',
			colorText: 'text-yellow-400',
			colorBg: 'bg-yellow-500/10',
			youtube: '@PuMoneyMind',
			avatar: '/coaches/pu.png',
			glow: '234,179,8'
		},
		{
			name: 'COACH CZECH',
			time: '12:00-14:00',
			startHour: 12,
			endHour: 14,
			channel: 'ALL Time High',
			color: 'from-green-500 to-emerald-400',
			colorBorder: 'border-green-500/30',
			colorText: 'text-green-400',
			colorBg: 'bg-green-500/10',
			youtube: '@alltimehigh.official',
			avatar: '/coaches/czech.png',
			glow: '34,197,94'
		},
		{
			name: 'COACH FUTURE',
			time: '14:00-16:00',
			startHour: 14,
			endHour: 16,
			channel: 'Trade the Future',
			color: 'from-teal-500 to-cyan-400',
			colorBorder: 'border-teal-500/30',
			colorText: 'text-teal-400',
			colorBg: 'bg-teal-500/10',
			youtube: '@tradethefuturebyfuture',
			avatar: '/coaches/future.png',
			glow: '20,184,166'
		},
		{
			name: 'COACH JHEE',
			time: '16:00-19:00',
			startHour: 16,
			endHour: 19,
			channel: 'Jhee Aroonwan',
			color: 'from-blue-500 to-indigo-400',
			colorBorder: 'border-blue-500/30',
			colorText: 'text-blue-400',
			colorBg: 'bg-blue-500/10',
			youtube: '@jheearoonwan',
			avatar: '/coaches/jhee.png',
			glow: '59,130,246'
		},
		{
			name: 'COACH ICZ',
			time: '19:00-21:00',
			startHour: 19,
			endHour: 21,
			channel: 'เทรดทองกับท่านสุดต๋าล',
			color: 'from-purple-500 to-violet-400',
			colorBorder: 'border-purple-500/30',
			colorText: 'text-purple-400',
			colorBg: 'bg-purple-500/10',
			youtube: '@portgoldtrader',
			avatar: '/coaches/icz.png',
			glow: '168,85,247'
		},
		{
			name: 'COACH DUK',
			time: '21:00-23:00',
			startHour: 21,
			endHour: 23,
			channel: 'PIDFAH',
			color: 'from-pink-500 to-fuchsia-400',
			colorBorder: 'border-pink-500/30',
			colorText: 'text-pink-400',
			colorBg: 'bg-pink-500/10',
			youtube: '@Pidfah',
			avatar: '/coaches/duk.png',
			glow: '217,70,239'
		},
		{
			name: 'COACH MAY',
			time: '23:00-02:00',
			startHour: 23,
			endHour: 26,
			channel: 'Mayday Channel',
			color: 'from-red-500 to-rose-400',
			colorBorder: 'border-red-500/30',
			colorText: 'text-red-400',
			colorBg: 'bg-red-500/10',
			youtube: '@MC.Maydaychannel',
			avatar: '/coaches/may.png',
			glow: '239,68,68'
		}
	];

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
		return coaches.findIndex((c) => isLive(c.startHour, c.endHour));
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-bold text-white">ELITE GOLD LIVE TRADE</h2>
			<p class="text-xs text-gray-500 mt-1">ตาราง Live Trade Master ประจำวัน</p>
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
				<div class="text-[9px] text-gray-500 -mt-0.5">Bangkok Time</div>
			</div>
		</div>
	</div>

	<!-- Coach list -->
	<div class="space-y-3">
		{#each coaches as coach, i}
			{@const live = i === liveCoachIndex}
			<div
				class="live-card relative rounded-2xl border transition-all duration-500
					{live
						? `${coach.colorBorder} ${coach.colorBg}`
						: 'border-dark-border bg-dark-surface hover:bg-dark-hover'}"
				style={live ? `--glow-rgb: ${coach.glow}` : ''}
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
						<div class="rounded-xl bg-gradient-to-r {coach.color} px-3 py-2 text-center">
							<div class="text-[10px] font-bold text-white tracking-wider">{coach.name}</div>
							<div class="text-[10px] text-white/80">{coach.time}</div>
						</div>
					</div>

					<!-- Avatar -->
					<div class="flex-shrink-0 relative">
						{#if live}
							<div class="absolute -inset-1 rounded-full animate-pulse-ring" style="background: rgba({coach.glow}, 0.25)"></div>
						{/if}
						<img
							src={coach.avatar}
							alt={coach.name}
							class="relative w-11 h-11 rounded-full object-cover border-2 transition-all duration-500
								{live ? coach.colorBorder : 'border-dark-border'}"
						/>
					</div>

					<!-- Channel info -->
					<div class="flex-1 min-w-0">
						<h3 class="text-sm font-semibold truncate transition-colors duration-500 {live ? 'text-white' : 'text-gray-300'}">{coach.channel}</h3>
						<a
							href="https://www.youtube.com/{coach.youtube}"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 mt-1.5 rounded-full bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
						>
							<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
								<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
							</svg>
							{coach.youtube}
						</a>
					</div>

					<!-- Time display -->
					<div class="flex-shrink-0 text-right hidden sm:block">
						<div class="text-sm font-mono transition-colors duration-500 {live ? coach.colorText : 'text-gray-500'}">
							{coach.time}
						</div>
						{#if live}
							<div class="text-[10px] {coach.colorText} mt-0.5 font-medium">กำลัง Live</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
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
