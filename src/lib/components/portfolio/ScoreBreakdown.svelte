<script lang="ts">
	import { formatCurrency } from '$lib/utils';

	let {
		totalProfit = 0,
		totalTrades = 0,
		sessionAsianProfit = 0,
		sessionLondonProfit = 0,
		sessionNewYorkProfit = 0,
		bestTrade = 0,
		worstTrade = 0
	}: {
		totalProfit?: number;
		totalTrades?: number;
		sessionAsianProfit?: number;
		sessionLondonProfit?: number;
		sessionNewYorkProfit?: number;
		bestTrade?: number;
		worstTrade?: number;
	} = $props();

	const profitPerTrade = $derived(totalTrades > 0 ? totalProfit / totalTrades : 0);
	const totalSessionAbs = $derived(
		Math.abs(sessionAsianProfit) + Math.abs(sessionLondonProfit) + Math.abs(sessionNewYorkProfit)
	);

	const sessions = $derived([
		{ name: 'Asian', profit: sessionAsianProfit, color: 'bg-brand-primary' },
		{ name: 'London', profit: sessionLondonProfit, color: 'bg-green-500' },
		{ name: 'New York', profit: sessionNewYorkProfit, color: 'bg-amber-500' }
	]);
</script>

<div class="card space-y-5">
	<h3 class="text-lg font-semibold text-white">สรุปกำไร/ขาดทุน</h3>

	<!-- Main Profit -->
	<div class="text-center">
		<div class="text-4xl font-bold {totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
			{formatCurrency(totalProfit)}
		</div>
		<div class="text-xs text-gray-400 mt-1">กำไรรวม</div>
	</div>

	<!-- Key Metrics -->
	<div class="grid grid-cols-2 gap-3">
		<div class="p-3 bg-dark-bg/50 rounded-lg text-center">
			<div class="text-xs text-gray-400">กำไร/เทรด</div>
			<div class="text-lg font-bold {profitPerTrade >= 0 ? 'text-green-400' : 'text-red-400'}">
				{formatCurrency(profitPerTrade)}
			</div>
		</div>
		<div class="p-3 bg-dark-bg/50 rounded-lg text-center">
			<div class="text-xs text-gray-400">เทรดทั้งหมด</div>
			<div class="text-lg font-bold text-white">{totalTrades}</div>
		</div>
		<div class="p-3 bg-dark-bg/50 rounded-lg text-center">
			<div class="text-xs text-gray-400">เทรดที่ดีที่สุด</div>
			<div class="text-lg font-bold text-green-400">{formatCurrency(bestTrade)}</div>
		</div>
		<div class="p-3 bg-dark-bg/50 rounded-lg text-center">
			<div class="text-xs text-gray-400">เทรดที่แย่ที่สุด</div>
			<div class="text-lg font-bold text-red-400">{formatCurrency(worstTrade)}</div>
		</div>
	</div>

	<!-- Session Contribution -->
	<div>
		<div class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
			กำไรตาม Session
		</div>
		<div class="space-y-2">
			{#each sessions as session}
				{@const barWidth = totalSessionAbs > 0 ? (Math.abs(session.profit) / totalSessionAbs) * 100 : 0}
				<div class="flex items-center gap-3">
					<div class="w-16 text-xs font-semibold text-gray-300 shrink-0">{session.name}</div>
					<div class="flex-1 h-5 bg-dark-bg/50 rounded overflow-hidden">
						<div
							class="h-full rounded transition-all duration-700 {session.profit >= 0 ? 'bg-green-500/40' : 'bg-red-500/40'}"
							style="width: {Math.max(barWidth, 2)}%"
						></div>
					</div>
					<div class="w-20 text-right text-xs font-mono font-bold {session.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
						{session.profit >= 0 ? '+' : ''}{session.profit.toFixed(2)}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
