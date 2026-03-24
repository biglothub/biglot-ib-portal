<script lang="ts">
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber } from '$lib/utils';
	import type { TagBreakdown, TagBreakdownItem, TagCategoryBreakdownItem } from '$lib/types';

	let { tagBreakdown } = $props<{
		tagBreakdown: TagBreakdown | null | undefined;
	}>();

	let tagSort = $state<{ key: string; asc: boolean }>({ key: 'netPnl', asc: false });
	let tagViewMode = $state('all');

	const sortedTags = $derived.by(() => {
		let arr = [...(tagBreakdown?.byTag || [])];
		if (tagViewMode !== 'all') arr = arr.filter((t: TagBreakdownItem) => t.category === tagViewMode);
		arr.sort((a: TagBreakdownItem, b: TagBreakdownItem) => {
			const va = (a as unknown as Record<string, number>)[tagSort.key] ?? 0;
			const vb = (b as unknown as Record<string, number>)[tagSort.key] ?? 0;
			return tagSort.asc ? va - vb : vb - va;
		});
		return arr;
	});

	function toggleTagSort(key: string) {
		if (tagSort.key === key) tagSort = { key, asc: !tagSort.asc };
		else tagSort = { key, asc: false };
	}

	const categoryLabels: Record<string, string> = {
		setup: 'กลยุทธ์',
		execution: 'การเข้าเทรด',
		emotion: 'อารมณ์',
		mistake: 'ข้อผิดพลาด',
		market_condition: 'สภาพตลาด',
		custom: 'กำหนดเอง'
	};

	const categoryColors: Record<string, string> = {
		setup: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
		execution: 'text-green-400 bg-green-500/10 border-green-500/20',
		emotion: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
		mistake: 'text-red-400 bg-red-500/10 border-red-500/20',
		market_condition: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
		custom: 'text-gray-400 bg-gray-500/10 border-gray-500/20'
	};
</script>

<!-- TAG PERFORMANCE -->
<div class="card">
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-lg font-semibold text-white">ผลลัพธ์ตามแท็ก</h2>
		<!-- Category filter pills -->
		<div class="flex gap-1.5 flex-wrap">
			<button
				class="px-3 py-1 text-xs rounded-full border transition-colors {tagViewMode === 'all' ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/40' : 'text-gray-400 border-dark-border hover:text-gray-300'}"
				onclick={() => tagViewMode = 'all'}
			>ทั้งหมด</button>
			{#each Object.entries(categoryLabels) as [key, label]}
				{#if tagBreakdown?.byCategory?.some((c: TagCategoryBreakdownItem) => c.category === key)}
					<button
						class="px-3 py-1 text-xs rounded-full border transition-colors {tagViewMode === key ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/40' : 'text-gray-400 border-dark-border hover:text-gray-300'}"
						onclick={() => tagViewMode = key}
					>{label}</button>
				{/if}
			{/each}
		</div>
	</div>

	{#if !tagBreakdown || tagBreakdown.byTag.length === 0}
		<EmptyState message="ยังไม่มีแท็กในเทรดที่กรอง — เพิ่มแท็กให้กับเทรดก่อน" />
	{:else}
		<!-- Category summary cards -->
		{#if tagViewMode === 'all' && tagBreakdown.byCategory.length > 0}
			<div class="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
				{#each tagBreakdown.byCategory as cat}
					<button
						class="rounded-xl border px-4 py-3 text-left transition-colors hover:border-brand-primary/30 {categoryColors[cat.category] || 'text-gray-400 bg-gray-500/10 border-gray-500/20'}"
						onclick={() => tagViewMode = cat.category}
					>
						<div class="text-xs opacity-70">{categoryLabels[cat.category] || cat.category}</div>
						<div class="mt-1 flex items-baseline gap-2">
							<span class="text-xl font-bold">{cat.tagCount}</span>
							<span class="text-xs opacity-60">แท็ก • {cat.trades} เทรด</span>
						</div>
						<div class="mt-1 flex items-center gap-3 text-xs">
							<span>WR {cat.winRate.toFixed(0)}%</span>
							<span class="{cat.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(cat.netPnl)}</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Bar chart — top tags by P&L -->
		{@const maxAbsTagPnl = sortedTags.reduce((max: number, t: TagBreakdownItem) => { const v = Math.abs(t.netPnl); return v > max ? v : max; }, 1)}
		<div class="space-y-2 mb-6">
			{#each sortedTags.slice(0, 10) as tag}
				<div class="flex items-center gap-3">
					<div class="w-32 flex items-center gap-2 min-w-0">
						<div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {tag.color}"></div>
						<span class="text-sm font-medium text-white truncate">{tag.tagName}</span>
					</div>
					<div class="flex-1 flex items-center">
						{#if tag.netPnl >= 0}
							<div class="h-5 rounded-r bg-green-500/50" style="width: {(tag.netPnl / maxAbsTagPnl) * 100}%"></div>
						{:else}
							<div class="h-5 rounded-l bg-red-500/50 ml-auto" style="width: {(Math.abs(tag.netPnl) / maxAbsTagPnl) * 100}%"></div>
						{/if}
					</div>
					<div class="w-24 text-right text-sm font-medium {tag.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(tag.netPnl)}
					</div>
				</div>
			{/each}
		</div>

		<!-- Full sortable table -->
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-400 text-[11px] uppercase tracking-wider">
						<th class="text-left py-2.5 font-medium">แท็ก</th>
						<th class="text-left py-2.5 font-medium">หมวดหมู่</th>
						{#each [
							{ key: 'trades', label: 'เทรด' },
							{ key: 'winRate', label: 'อัตราชนะ' },
							{ key: 'profitFactor', label: 'PF' },
							{ key: 'netPnl', label: 'กำไรสุทธิ' },
							{ key: 'avgPnl', label: 'เฉลี่ย' },
						] as col}
							<th class="text-right py-2.5 font-medium cursor-pointer hover:text-gray-300 select-none" onclick={() => toggleTagSort(col.key)}>
								{col.label}
								{#if tagSort.key === col.key}
									<span class="ml-0.5">{tagSort.asc ? '▲' : '▼'}</span>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sortedTags as tag}
						<tr class="border-b border-dark-border/40 hover:bg-dark-bg/30">
							<td class="py-2.5">
								<div class="flex items-center gap-2">
									<div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {tag.color}"></div>
									<span class="font-medium text-white">{tag.tagName}</span>
								</div>
							</td>
							<td class="py-2.5">
								<span class="text-xs px-2 py-0.5 rounded-full border {categoryColors[tag.category] || 'text-gray-400 border-gray-500/20'}">
									{categoryLabels[tag.category] || tag.category}
								</span>
							</td>
							<td class="py-2.5 text-right text-gray-300">{tag.trades}</td>
							<td class="py-2.5 text-right {tag.winRate >= 50 ? 'text-green-400' : 'text-red-400'}">{tag.winRate.toFixed(0)}%</td>
							<td class="py-2.5 text-right {tag.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{tag.profitFactor === Infinity ? '∞' : formatNumber(tag.profitFactor)}</td>
							<td class="py-2.5 text-right font-medium {tag.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(tag.netPnl)}</td>
							<td class="py-2.5 text-right {tag.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(tag.avgPnl)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
