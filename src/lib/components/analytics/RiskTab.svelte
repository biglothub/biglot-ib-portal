<script lang="ts">
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';

	let { riskAnalysis } = $props<{
		riskAnalysis: Record<string, any> | null | undefined;
	}>();
</script>

<!-- RISK ANALYSIS -->
{#if !riskAnalysis}
	<div class="card">
		<EmptyState message="ยังไม่มีข้อมูลเพียงพอสำหรับวิเคราะห์ความเสี่ยง" />
	</div>
{:else}
	<!-- Risk KPI Cards -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="card border-l-2 border-l-red-500">
			<div class="text-xs text-gray-500 uppercase tracking-wider">Drawdown สูงสุด</div>
			<div class="mt-1.5 text-2xl font-bold text-red-400">{formatCurrency(riskAnalysis.maxDrawdown)}</div>
			{#if riskAnalysis.maxDrawdownDate}
				<div class="text-xs text-gray-500 mt-1">{riskAnalysis.maxDrawdownDate}</div>
			{/if}
		</div>
		<div class="card border-l-2 border-l-amber-500">
			<div class="text-xs text-gray-500 uppercase tracking-wider">Drawdown เฉลี่ย</div>
			<div class="mt-1.5 text-2xl font-bold text-amber-400">{formatCurrency(riskAnalysis.avgDrawdown)}</div>
			<div class="text-xs text-gray-500 mt-1">{riskAnalysis.drawdownPeriodCount} ช่วง</div>
		</div>
		<div class="card border-l-2 border-l-red-400">
			<div class="text-xs text-gray-500 uppercase tracking-wider">ขาดทุนสูงสุด</div>
			<div class="mt-1.5 text-2xl font-bold text-red-400">{formatCurrency(riskAnalysis.largestLoss)}</div>
		</div>
		<div class="card border-l-2 border-l-orange-500">
			<div class="text-xs text-gray-500 uppercase tracking-wider">แพ้ติดต่อสูงสุด</div>
			<div class="mt-1.5 text-2xl font-bold text-orange-400">{riskAnalysis.maxLossStreak} เทรด</div>
		</div>
	</div>

	<!-- Risk-adjusted Ratios -->
	<div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
		{#each [
			{ label: 'Sharpe Ratio', value: riskAnalysis.sharpeRatio, good: 1, great: 2 },
			{ label: 'Sortino Ratio', value: riskAnalysis.sortinoRatio, good: 1.5, great: 3 },
			{ label: 'Calmar Ratio', value: riskAnalysis.calmarRatio, good: 1, great: 3 },
			{ label: 'ความผันผวนรายวัน', value: riskAnalysis.dailyVolatility, good: -1, great: -1 },
			{ label: 'ผลตอบแทนเฉลี่ย/วัน', value: riskAnalysis.avgDailyReturn, good: 0, great: 0.1 }
		] as ratio}
			{@const color = ratio.label === 'ความผันผวนรายวัน'
				? 'text-gray-300'
				: ratio.value >= ratio.great ? 'text-green-400' : ratio.value >= ratio.good ? 'text-amber-400' : 'text-red-400'}
			<div class="card text-center">
				<div class="text-xs text-gray-500 uppercase tracking-wider">{ratio.label}</div>
				<div class="mt-2 text-xl font-bold {color}">
					{ratio.label.includes('ผันผวน') || ratio.label.includes('ผลตอบแทน')
						? `${ratio.value.toFixed(2)}%`
						: ratio.value.toFixed(2)}
				</div>
			</div>
		{/each}
	</div>

	<!-- Drawdown Chart -->
	<div class="card">
		<h3 class="text-sm font-semibold text-white mb-4">กราฟ Drawdown</h3>
		{#if riskAnalysis.drawdownSeries.length === 0}
			<EmptyState message="ยังไม่มีข้อมูล drawdown" />
		{:else}
			{@const series = riskAnalysis.drawdownSeries}
			{@const minDD = series.reduce((min: number, s: { drawdown: number }) => s.drawdown < min ? s.drawdown : min, Infinity)}
			{@const range = -minDD || 1}
			<div class="h-64 relative">
				<svg class="w-full h-full" viewBox="0 0 {series.length * 10} 200" preserveAspectRatio="none">
					<line x1="0" y1="0" x2="{series.length * 10}" y2="0" stroke="#4B5563" stroke-width="0.5" />
					<path
						d="M0,0 {series.map((s: { drawdown: number }, i: number) => `L${i * 10},${(-s.drawdown / range) * 200}`).join(' ')} L{(series.length - 1) * 10},0 Z"
						fill="rgba(239, 68, 68, 0.15)"
					/>
					<path
						d="M0,{(-series[0].drawdown / range) * 200} {series.map((s: { drawdown: number }, i: number) => `L${i * 10},${(-s.drawdown / range) * 200}`).join(' ')}"
						fill="none"
						stroke="#EF4444"
						stroke-width="1.5"
					/>
				</svg>
				<div class="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
					<span>{series[0]?.date || ''}</span>
					{#if series.length > 2}
						<span>{series[Math.floor(series.length / 2)]?.date || ''}</span>
					{/if}
					<span>{series[series.length - 1]?.date || ''}</span>
				</div>
				<div class="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-gray-500 pointer-events-none">
					<span>$0</span>
					<span>{formatCurrency(minDD)}</span>
				</div>
			</div>
		{/if}
	</div>

	<!-- Drawdown Periods Table + R:R Distribution -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Drawdown Periods -->
		<div class="card">
			<h3 class="text-sm font-semibold text-white mb-4">ช่วง Drawdown (10 อันดับ)</h3>
			{#if riskAnalysis.topDrawdowns.length === 0}
				<EmptyState message="ไม่พบ drawdown periods" />
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-[11px] uppercase tracking-wider">
								<th class="text-left py-2 font-medium">เริ่มต้น</th>
								<th class="text-right py-2 font-medium">DD สูงสุด</th>
								<th class="text-right py-2 font-medium">ระยะเวลา</th>
								<th class="text-right py-2 font-medium">ฟื้นตัว</th>
							</tr>
						</thead>
						<tbody>
							{#each riskAnalysis.topDrawdowns as period}
								<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
									<td class="py-2 text-gray-300 text-xs">{period.startDate}</td>
									<td class="py-2 text-right text-red-400 font-medium">{formatCurrency(period.maxDrawdown)}</td>
									<td class="py-2 text-right text-gray-300">{period.durationDays}d</td>
									<td class="py-2 text-right {period.recoveryDate ? 'text-green-400' : 'text-amber-400'}">
										{period.recoveryDays !== null ? `${period.recoveryDays}d` : 'ยังไม่ฟื้นตัว'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<div class="mt-3 text-xs text-gray-500">
					ระยะเวลาเฉลี่ย: {riskAnalysis.avgDrawdownDuration} วัน
				</div>
			{/if}
		</div>

		<!-- R:R Distribution -->
		<div class="card">
			<h3 class="text-sm font-semibold text-white mb-4">การกระจาย R:R</h3>
			{#if riskAnalysis.totalRRTrades === 0}
				<EmptyState message="ไม่มีเทรดที่มี Stop Loss สำหรับคำนวณ R:R" />
			{:else}
				<div class="space-y-3">
					{#each riskAnalysis.rrDistribution as bucket}
						{@const maxCount = riskAnalysis.rrDistribution.reduce((max: number, b: { count: number }) => b.count > max ? b.count : max, 1)}
						{@const pct = bucket.count > 0 ? (bucket.count / riskAnalysis.totalRRTrades) * 100 : 0}
						{@const winPct = bucket.count > 0 ? (bucket.wins / bucket.count) * 100 : 0}
						<div>
							<div class="flex justify-between text-xs mb-1">
								<span class="text-gray-400">{bucket.label} R:R</span>
								<span class="text-gray-300">{bucket.count} เทรด ({pct.toFixed(0)}%)</span>
							</div>
							<div class="h-5 bg-dark-bg rounded-full overflow-hidden flex">
								{#if bucket.count > 0}
									<div
										class="h-full bg-green-500/60 transition-all"
										style="width: {(bucket.wins / maxCount) * 100}%"
									></div>
									<div
										class="h-full bg-red-500/60 transition-all"
										style="width: {(bucket.losses / maxCount) * 100}%"
									></div>
								{/if}
							</div>
							{#if bucket.count > 0}
								<div class="flex justify-between text-[10px] mt-0.5">
									<span class="text-green-400">ชนะ {winPct.toFixed(0)}%</span>
									<span class="text-red-400">แพ้ {(100 - winPct).toFixed(0)}%</span>
								</div>
							{/if}
						</div>
					{/each}
				</div>
				<div class="mt-3 text-xs text-gray-500">
					จากเทรดทั้งหมด {riskAnalysis.totalRRTrades} เทรดที่มี Stop Loss
				</div>
			{/if}
		</div>
	</div>

	<!-- Risk Summary Row -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
		<div class="card text-center">
			<div class="text-xs text-gray-500 uppercase tracking-wider">ส่วนเบี่ยงเบน P&L/วัน</div>
			<div class="mt-2 text-lg font-bold text-gray-300">{formatCurrency(riskAnalysis.dailyStdDev)}</div>
		</div>
		<div class="card text-center">
			<div class="text-xs text-gray-500 uppercase tracking-wider">กำไรเฉลี่ย/วัน</div>
			<div class="mt-2 text-lg font-bold {riskAnalysis.dailyMean >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(riskAnalysis.dailyMean)}</div>
		</div>
		<div class="card text-center">
			<div class="text-xs text-gray-500 uppercase tracking-wider">ชนะมากสุด</div>
			<div class="mt-2 text-lg font-bold text-green-400">{formatCurrency(riskAnalysis.largestWin)}</div>
		</div>
		<div class="card text-center">
			<div class="text-xs text-gray-500 uppercase tracking-wider">จำนวนช่วง DD</div>
			<div class="mt-2 text-lg font-bold text-gray-300">{riskAnalysis.drawdownPeriodCount}</div>
		</div>
	</div>
{/if}
