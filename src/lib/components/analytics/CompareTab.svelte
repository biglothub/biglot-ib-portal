<script lang="ts">
	import { formatCurrency, formatNumber } from '$lib/utils';

	let { filteredTrades } = $props<{
		filteredTrades: any[];
	}>();

	let group1Symbol = $state('');
	let group2Symbol = $state('');
	let group1Side = $state('');
	let group2Side = $state('');
	let compareResult = $state<{ group1: Record<string, number>; group2: Record<string, number> } | null>(null);

	const availableSymbols = $derived([...new Set((filteredTrades || []).map((t: any) => t.symbol))].sort());

	function generateCompare() {
		if (!filteredTrades) return;
		const trades = filteredTrades;

		const filterGroup = (sym: string, side: string) => {
			return trades.filter((t: any) => {
				if (sym && t.symbol !== sym) return false;
				if (side && t.type !== side) return false;
				return true;
			});
		};

		const calcGroupStats = (groupTrades: any[]) => {
			const wins = groupTrades.filter((t: any) => Number(t.profit) > 0);
			const losses = groupTrades.filter((t: any) => Number(t.profit) < 0);
			const totalW = wins.reduce((s: number, t: any) => s + Number(t.profit), 0);
			const totalL = Math.abs(losses.reduce((s: number, t: any) => s + Number(t.profit), 0));
			const netPnl = groupTrades.reduce((s: number, t: any) => s + Number(t.profit), 0);
			return {
				trades: groupTrades.length,
				wins: wins.length,
				losses: losses.length,
				winRate: groupTrades.length > 0 ? (wins.length / groupTrades.length) * 100 : 0,
				profitFactor: totalL > 0 ? totalW / totalL : 0,
				netPnl,
				avgPnl: groupTrades.length > 0 ? netPnl / groupTrades.length : 0,
			};
		};

		const g1 = calcGroupStats(filterGroup(group1Symbol, group1Side));
		const g2 = calcGroupStats(filterGroup(group2Symbol, group2Side));

		compareResult = { group1: g1, group2: g2 };
	}
</script>

<!-- COMPARE TOOL -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
	<div class="card">
		<h3 class="text-sm font-semibold text-white mb-4">กลุ่ม #1</h3>
		<div class="space-y-3">
			<div>
				<label for="g1-symbol" class="text-xs text-gray-500">สัญลักษณ์</label>
				<select id="g1-symbol" bind:value={group1Symbol} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
					<option value="">ทุกสัญลักษณ์</option>
					{#each availableSymbols as sym}
						<option value={sym}>{sym}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="g1-side" class="text-xs text-gray-500">ทิศทาง</label>
				<select id="g1-side" bind:value={group1Side} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
					<option value="">ทุกทิศทาง</option>
					<option value="BUY">BUY</option>
					<option value="SELL">SELL</option>
				</select>
			</div>
		</div>
	</div>
	<div class="card">
		<h3 class="text-sm font-semibold text-white mb-4">กลุ่ม #2</h3>
		<div class="space-y-3">
			<div>
				<label for="g2-symbol" class="text-xs text-gray-500">สัญลักษณ์</label>
				<select id="g2-symbol" bind:value={group2Symbol} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
					<option value="">ทุกสัญลักษณ์</option>
					{#each availableSymbols as sym}
						<option value={sym}>{sym}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="g2-side" class="text-xs text-gray-500">ทิศทาง</label>
				<select id="g2-side" bind:value={group2Side} class="mt-1 w-full rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white">
					<option value="">ทุกทิศทาง</option>
					<option value="BUY">BUY</option>
					<option value="SELL">SELL</option>
				</select>
			</div>
		</div>
	</div>
</div>

<div class="flex gap-3 justify-end">
	<button
		onclick={() => { group1Symbol = ''; group1Side = ''; group2Symbol = ''; group2Side = ''; compareResult = null; }}
		class="px-4 py-2 rounded-lg border border-dark-border text-sm text-gray-400 hover:text-white"
	>รีเซ็ต</button>
	<button
		onclick={generateCompare}
		class="px-6 py-2 rounded-lg bg-brand-primary text-dark-bg text-sm font-semibold hover:opacity-90"
	>สร้างรายงาน</button>
</div>

{#if compareResult}
	<div class="card">
		<h3 class="text-sm font-semibold text-white mb-4">ผลการเปรียบเทียบ</h3>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-500 text-[11px] uppercase tracking-wider">
						<th class="text-left py-2.5 font-medium">ตัวชี้วัด</th>
						<th class="text-right py-2.5 font-medium">กลุ่ม #1</th>
						<th class="text-right py-2.5 font-medium">กลุ่ม #2</th>
						<th class="text-right py-2.5 font-medium">ผลต่าง</th>
					</tr>
				</thead>
				<tbody>
					{#each [
						{ label: 'จำนวนเทรด', g1: compareResult.group1.trades, g2: compareResult.group2.trades, fmt: 'num' },
						{ label: 'อัตราชนะ', g1: compareResult.group1.winRate, g2: compareResult.group2.winRate, fmt: 'pct' },
						{ label: 'อัตราส่วนกำไร', g1: compareResult.group1.profitFactor, g2: compareResult.group2.profitFactor, fmt: 'num' },
						{ label: 'กำไรสุทธิ', g1: compareResult.group1.netPnl, g2: compareResult.group2.netPnl, fmt: 'cur' },
						{ label: 'กำไรเฉลี่ย', g1: compareResult.group1.avgPnl, g2: compareResult.group2.avgPnl, fmt: 'cur' },
					] as m}
						{@const diff = m.g1 - m.g2}
						<tr class="border-b border-dark-border/40">
							<td class="py-2.5 text-gray-300">{m.label}</td>
							<td class="py-2.5 text-right text-white">
								{m.fmt === 'cur' ? formatCurrency(m.g1) : m.fmt === 'pct' ? `${m.g1.toFixed(1)}%` : formatNumber(m.g1)}
							</td>
							<td class="py-2.5 text-right text-white">
								{m.fmt === 'cur' ? formatCurrency(m.g2) : m.fmt === 'pct' ? `${m.g2.toFixed(1)}%` : formatNumber(m.g2)}
							</td>
							<td class="py-2.5 text-right font-medium {diff >= 0 ? 'text-green-400' : 'text-red-400'}">
								{diff >= 0 ? '+' : ''}{m.fmt === 'cur' ? formatCurrency(diff) : m.fmt === 'pct' ? `${diff.toFixed(1)}%` : formatNumber(diff)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
