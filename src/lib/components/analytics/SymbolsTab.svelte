<script lang="ts">
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';
	import type { SymbolBreakdownItem } from '$lib/types';

	let { symbolBreakdown } = $props<{
		symbolBreakdown: SymbolBreakdownItem[];
	}>();

	let symbolSort = $state<{ key: string; asc: boolean }>({ key: 'netPnl', asc: false });

	const sortedSymbols = $derived.by(() => {
		const arr = [...(symbolBreakdown || [])];
		arr.sort((a: SymbolBreakdownItem, b: SymbolBreakdownItem) => {
			const va = (a as unknown as Record<string, number>)[symbolSort.key] ?? 0;
			const vb = (b as unknown as Record<string, number>)[symbolSort.key] ?? 0;
			return symbolSort.asc ? va - vb : vb - va;
		});
		return arr;
	});

	function toggleSort(key: string) {
		if (symbolSort.key === key) symbolSort = { key, asc: !symbolSort.asc };
		else symbolSort = { key, asc: false };
	}
</script>

<!-- SYMBOLS BREAKDOWN -->
<div class="card">
	<h2 class="text-lg font-semibold text-white mb-4">ผลลัพธ์ตามสัญลักษณ์</h2>
	{#if sortedSymbols.length === 0}
		<EmptyState message="ไม่พบข้อมูล symbol ใน filter ที่เลือก" />
	{:else}
		<!-- Top symbols bar chart -->
		{@const maxAbsPnl = sortedSymbols.reduce((max: number, s: SymbolBreakdownItem) => { const v = Math.abs(s.netPnl); return v > max ? v : max; }, 1)}
		<div class="space-y-2 mb-6">
			{#each sortedSymbols.slice(0, 8) as sym}
				<div class="flex items-center gap-3">
					<div class="w-20 text-sm font-medium text-white">{sym.symbol}</div>
					<div class="flex-1 flex items-center">
						{#if sym.netPnl >= 0}
							<div class="h-5 rounded-r bg-green-500/50" style="width: {(sym.netPnl / maxAbsPnl) * 100}%"></div>
						{:else}
							<div class="h-5 rounded-l bg-red-500/50 ml-auto" style="width: {(Math.abs(sym.netPnl) / maxAbsPnl) * 100}%"></div>
						{/if}
					</div>
					<div class="w-24 text-right text-sm font-medium {sym.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(sym.netPnl)}
					</div>
				</div>
			{/each}
		</div>

		<!-- Full table -->
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-400 text-[11px] uppercase tracking-wider">
						<th class="text-left py-2.5 font-medium">สัญลักษณ์</th>
						{#each [
							{ key: 'trades', label: 'เทรด' },
							{ key: 'winRate', label: 'อัตราชนะ' },
							{ key: 'profitFactor', label: 'PF' },
							{ key: 'netPnl', label: 'กำไรสุทธิ' },
							{ key: 'avgPnl', label: 'เฉลี่ย' },
						] as col}
							<th class="text-right py-2.5 font-medium cursor-pointer hover:text-gray-300 select-none" onclick={() => toggleSort(col.key)}>
								{col.label}
								{#if symbolSort.key === col.key}
									<span class="ml-0.5">{symbolSort.asc ? '▲' : '▼'}</span>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sortedSymbols as sym}
						<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
							<td class="py-2.5 font-medium text-white">{sym.symbol}</td>
							<td class="py-2.5 text-right text-gray-300">{sym.trades}</td>
							<td class="py-2.5 text-right {sym.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{sym.winRate.toFixed(0)}%</td>
							<td class="py-2.5 text-right {sym.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{sym.profitFactor === Infinity ? '∞' : formatNumber(sym.profitFactor)}</td>
							<td class="py-2.5 text-right font-medium {sym.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(sym.netPnl)}</td>
							<td class="py-2.5 text-right {sym.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(sym.avgPnl)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
