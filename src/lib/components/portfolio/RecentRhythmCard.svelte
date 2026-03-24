<script lang="ts">
	type DailyHistoryItem = {
		date: string;
		profit: number;
		totalTrades?: number;
	};

	type TradeItem = {
		symbol: string;
		profit: number;
		closeTime: string;
	};

	type SymbolSummary = {
		symbol: string;
		count: number;
		profit: number;
		winRate: number;
	};

	let {
		dailyHistory = [],
		history = []
	}: {
		dailyHistory?: DailyHistoryItem[];
		history?: TradeItem[];
	} = $props();

	function formatSigned(value: number, digits = 2): string {
		return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
	}

	function formatLastTrade(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return 'No trades yet';
		return new Intl.DateTimeFormat('th-TH', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}

	function formatDayLabel(value: string): string {
		const date = new Date(`${value}T12:00:00`);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
	}

	const recentDays = $derived(
		(dailyHistory || []).slice(-7).map(day => ({
			...day,
			label: formatDayLabel(day.date)
		}))
	);

	const maxAbsRecentProfit = $derived(
		recentDays.reduce((max, day) => { const v = Math.abs(Number(day.profit) || 0); return v > max ? v : max; }, 1)
	);

	const netRecentProfit = $derived(
		recentDays.reduce((sum, day) => sum + (Number(day.profit) || 0), 0)
	);

	const greenDays = $derived(
		recentDays.filter(day => Number(day.profit) > 0).length
	);

	const avgTradesPerDay = $derived(
		recentDays.length
			? recentDays.reduce((sum, day) => sum + (day.totalTrades || 0), 0) / recentDays.length
			: 0
	);

	const latestTrade = $derived((history || [])[0] ?? null);

	const topSymbols = $derived.by((): SymbolSummary[] => {
		const symbolMap = new Map<string, { symbol: string; count: number; profit: number; wins: number }>();

		for (const trade of (history || [])) {
			const key = trade.symbol || 'Unknown';
			const entry = symbolMap.get(key) ?? { symbol: key, count: 0, profit: 0, wins: 0 };
			entry.count += 1;
			entry.profit += Number(trade.profit) || 0;
			if (Number(trade.profit) > 0) entry.wins += 1;
			symbolMap.set(key, entry);
		}

		return Array.from(symbolMap.values())
			.map(s => ({
				symbol: s.symbol,
				count: s.count,
				profit: s.profit,
				winRate: s.count > 0 ? (s.wins / s.count) * 100 : 0
			}))
			.sort((a, b) => b.count - a.count || Math.abs(b.profit) - Math.abs(a.profit))
			.slice(0, 3);
	});
</script>

<div class="card">
	<div class="flex items-start justify-between gap-3">
		<div>
			<p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-gray-400">Recent Rhythm</p>
			<h3 class="mt-1 text-lg font-semibold text-white">Trading Footprint</h3>
			<p class="mt-1 text-xs leading-5 text-gray-400">Last 7 trading days plus the symbols doing most of the work.</p>
		</div>
		<div class="rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
			Live Form
		</div>
	</div>

	<div class="mt-4 rounded-2xl border border-dark-border bg-dark-bg/40 p-4">
		<div class="flex items-end justify-between gap-3">
			<div>
				<p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">7D Net P/L</p>
				<p class="mt-1 text-2xl font-semibold tabular-nums {netRecentProfit >= 0 ? 'text-green-400' : 'text-red-400'}">
					{formatSigned(netRecentProfit)}
				</p>
			</div>
			<div class="text-right">
				<p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-gray-400">Green Days</p>
				<p class="mt-1 text-sm font-semibold text-white">{greenDays}/{recentDays.length || 0}</p>
			</div>
		</div>

		<div class="mt-3 flex items-center justify-between text-[11px] text-gray-400">
			<span>{avgTradesPerDay.toFixed(1)} avg trades/day</span>
			<span>{recentDays.length} active days</span>
		</div>

		{#if recentDays.length > 0}
			<div class="mt-4 grid grid-cols-7 gap-2">
				{#each recentDays as day}
					{@const intensity = Math.max((Math.abs(Number(day.profit) || 0) / maxAbsRecentProfit) * 100, 14)}
					<div class="rounded-xl border px-2 py-2.5 text-center transition-colors
						{Number(day.profit) > 0
							? 'border-green-500/20 bg-green-500/10'
							: Number(day.profit) < 0
								? 'border-red-500/20 bg-red-500/10'
								: 'border-dark-border bg-dark-bg/30'}"
					>
						<div class="text-[10px] font-semibold text-gray-400">{day.label}</div>
						<div class="mt-2 flex h-10 items-end">
							<div
								class="w-full rounded-md transition-all
									{Number(day.profit) > 0
										? 'bg-green-500/55'
										: Number(day.profit) < 0
											? 'bg-red-500/55'
											: 'bg-gray-600/60'}"
								style="height: {intensity}%"
							></div>
						</div>
						<div class="mt-2 text-[10px] font-mono text-gray-400">{day.totalTrades || 0}T</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="mt-4 rounded-xl border border-dashed border-dark-border px-3 py-4 text-center text-xs text-gray-400">
				Recent daily data is not available yet.
			</div>
		{/if}
	</div>

	<div class="mt-4">
		<div class="flex items-center justify-between gap-3">
			<p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-gray-400">Top Symbols</p>
			<p class="text-[11px] text-gray-400">
				{latestTrade ? `Last trade ${formatLastTrade(latestTrade.closeTime)}` : 'No recent close'}
			</p>
		</div>

		{#if topSymbols.length > 0}
			<div class="mt-3 space-y-2">
				{#each topSymbols as symbol}
					<div class="flex items-center justify-between rounded-xl bg-dark-bg/40 px-3 py-2.5">
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold text-white">{symbol.symbol}</p>
							<p class="text-[11px] text-gray-400">{symbol.count} trades</p>
						</div>
						<div class="text-right">
							<p class="text-xs font-mono font-semibold tabular-nums {symbol.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
								{formatSigned(symbol.profit)}
							</p>
							<p class="text-[11px] text-gray-400">{symbol.winRate.toFixed(0)}% win</p>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="mt-3 rounded-xl border border-dashed border-dark-border px-3 py-4 text-center text-xs text-gray-400">
				Symbol breakdown will appear once trades are available.
			</div>
		{/if}
	</div>
</div>
