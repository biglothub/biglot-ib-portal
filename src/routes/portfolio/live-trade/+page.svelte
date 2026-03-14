<script lang="ts">
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
			youtube: '@goldwithping'
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
			youtube: '@trader10x'
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
			youtube: '@pumoneymind'
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
			youtube: '@alltimehigh'
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
			youtube: '@tradethefuture'
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
			youtube: '@jheearoonwan'
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
			youtube: '@coachicz'
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
			youtube: '@pidfah'
		},
		{
			name: 'COACH MAY',
			time: '23:00-02:00',
			startHour: 23,
			endHour: 26, // 2:00 next day = 26 for comparison
			channel: 'Mayday Channel',
			color: 'from-red-500 to-rose-400',
			colorBorder: 'border-red-500/30',
			colorText: 'text-red-400',
			colorBg: 'bg-red-500/10',
			youtube: '@maydaychannel'
		}
	];

	function getBangkokHour(): number {
		const now = new Date();
		const utcHour = now.getUTCHours();
		const utcMinute = now.getUTCMinutes();
		return ((utcHour + 7) % 24) + utcMinute / 60;
	}

	function isLive(startHour: number, endHour: number): boolean {
		const now = getBangkokHour();
		if (endHour > 24) {
			// Wraps past midnight (e.g. 23:00-02:00)
			return now >= startHour || now < endHour - 24;
		}
		return now >= startHour && now < endHour;
	}

	// Re-check every minute
	let tick = $state(0);
	let tickInterval: ReturnType<typeof setInterval> | undefined;

	import { onMount } from 'svelte';

	onMount(() => {
		tickInterval = setInterval(() => tick++, 60000);
		return () => clearInterval(tickInterval);
	});

	let liveCoachIndex = $derived.by(() => {
		void tick; // reactivity trigger
		return coaches.findIndex((c) => isLive(c.startHour, c.endHour));
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-bold text-white">ELITE GOLD LIVE TRADE</h2>
			<p class="text-xs text-gray-500 mt-1">ตาราง Live Trade Master ประจำวัน</p>
		</div>
		{#if liveCoachIndex >= 0}
			<div class="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5">
				<span class="relative flex h-2.5 w-2.5">
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
					<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
				</span>
				<span class="text-xs text-green-400 font-medium">LIVE NOW</span>
			</div>
		{/if}
	</div>

	<div class="space-y-3">
		{#each coaches as coach, i}
			{@const live = i === liveCoachIndex}
			<div
				class="relative rounded-2xl border transition-all duration-300
					{live
						? `${coach.colorBorder} ${coach.colorBg} shadow-lg`
						: 'border-dark-border bg-dark-surface hover:bg-dark-hover'}"
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

					<!-- Channel info -->
					<div class="flex-1 min-w-0">
						<h3 class="text-sm font-semibold text-white truncate">{coach.channel}</h3>
						<div class="flex items-center gap-2 mt-1">
							<span class="text-[11px] text-gray-500">{coach.youtube}</span>
						</div>
					</div>

					<!-- Time display -->
					<div class="flex-shrink-0 text-right hidden sm:block">
						<div class="text-sm font-mono {live ? coach.colorText : 'text-gray-400'}">
							{coach.time}
						</div>
						{#if live}
							<div class="text-[10px] {coach.colorText} mt-0.5">กำลัง Live</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
