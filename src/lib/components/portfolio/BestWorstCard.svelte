<script lang="ts">
	import type { Trade } from '$lib/types';
	import { formatCurrency, formatDateTime } from '$lib/utils';

	let { best, worst }: { best: Trade | null; worst: Trade | null } = $props();
</script>

<div class="card">
	<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-3">จุดสูงสุด & ต่ำสุด</p>

	{#if !best && !worst}
		<p class="text-xs text-gray-500 text-center py-4">ยังไม่มีข้อมูล</p>
	{:else}
		<div class="space-y-2">
			{#if best}
				<a
					href={`/portfolio/trades/${best.id}`}
					class="flex items-center justify-between rounded-lg border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 px-3 py-2.5 transition-colors"
				>
					<div class="min-w-0">
						<div class="flex items-center gap-1.5">
							<span class="text-green-400 text-xs">▲</span>
							<span class="text-[10px] uppercase tracking-wider text-gray-400">เทรดชนะสูงสุด</span>
						</div>
						<div class="mt-1 text-sm font-medium text-white truncate">
							{best.symbol}
						</div>
						<div class="text-[10px] text-gray-500 mt-0.5">
							{formatDateTime(best.close_time)}
						</div>
					</div>
					<div class="text-right ml-3 shrink-0">
						<div class="text-base font-semibold text-green-400">
							{formatCurrency(Number(best.profit || 0))}
						</div>
					</div>
				</a>
			{/if}

			{#if worst}
				<a
					href={`/portfolio/trades/${worst.id}`}
					class="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 px-3 py-2.5 transition-colors"
				>
					<div class="min-w-0">
						<div class="flex items-center gap-1.5">
							<span class="text-red-400 text-xs">▼</span>
							<span class="text-[10px] uppercase tracking-wider text-gray-400">เทรดขาดทุนสูงสุด</span>
						</div>
						<div class="mt-1 text-sm font-medium text-white truncate">
							{worst.symbol}
						</div>
						<div class="text-[10px] text-gray-500 mt-0.5">
							{formatDateTime(worst.close_time)}
						</div>
					</div>
					<div class="text-right ml-3 shrink-0">
						<div class="text-base font-semibold text-red-400">
							{formatCurrency(Number(worst.profit || 0))}
						</div>
					</div>
				</a>
			{/if}
		</div>
	{/if}
</div>
