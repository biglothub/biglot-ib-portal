<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency, formatNumber, formatDateTime } from '$lib/utils';

	let { data } = $props();
	let trades = $derived(data.trades || []);
	let total = $derived(data.total || 0);
	let currentPage = $derived(data.page || 1);
	let pageSize = $derived(data.pageSize || 25);
	let symbols = $derived(data.symbols || []);
	let filters: any = $derived(data.filters || {});
	let tags = $derived(data.tags || []);

	// Filter states
	let fSymbol = $state('');
	let fType = $state('');
	let fResult = $state('');
	let fFrom = $state('');
	let fTo = $state('');
	let fTag = $state('');

	// Sync filter states when data changes
	$effect(() => {
		fSymbol = filters.symbol || '';
		fType = filters.type || '';
		fResult = filters.result || '';
		fFrom = filters.from || '';
		fTo = filters.to || '';
		fTag = filters.tagId || '';
	});

	const totalPages = $derived(Math.ceil(total / pageSize));

	function applyFilters() {
		const params = new URLSearchParams();
		if (fSymbol) params.set('symbol', fSymbol);
		if (fType) params.set('type', fType);
		if (fResult) params.set('result', fResult);
		if (fFrom) params.set('from', fFrom);
		if (fTo) params.set('to', fTo);
		if (fTag) params.set('tag', fTag);
		params.set('page', '1');
		goto(`/portfolio/trades?${params.toString()}`);
	}

	function clearFilters() {
		fSymbol = '';
		fType = '';
		fResult = '';
		fFrom = '';
		fTo = '';
		fTag = '';
		goto('/portfolio/trades');
	}

	function goToPage(p: number) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(p));
		goto(`/portfolio/trades?${params.toString()}`);
	}

	const hasFilters = $derived(fSymbol || fType || fResult || fFrom || fTo || fTag);

	function getDuration(openTime: string, closeTime: string): string {
		const ms = new Date(closeTime).getTime() - new Date(openTime).getTime();
		const mins = Math.floor(ms / 60000);
		if (mins < 60) return `${mins}m`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ${mins % 60}m`;
		const days = Math.floor(hours / 24);
		return `${days}d ${hours % 24}h`;
	}
</script>

<div class="space-y-4">
	<!-- Filters -->
	<div class="card p-4">
		<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
			<select
				bind:value={fSymbol}
				onchange={applyFilters}
				class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
			>
				<option value="">ทุก Symbol</option>
				{#each symbols as s}
					<option value={s}>{s}</option>
				{/each}
			</select>

			<select
				bind:value={fType}
				onchange={applyFilters}
				class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
			>
				<option value="">ทุก Type</option>
				<option value="BUY">BUY</option>
				<option value="SELL">SELL</option>
			</select>

			<select
				bind:value={fResult}
				onchange={applyFilters}
				class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
			>
				<option value="">ทุกผลลัพธ์</option>
				<option value="win">Win</option>
				<option value="loss">Loss</option>
				<option value="breakeven">Breakeven</option>
			</select>

			<input
				type="date"
				bind:value={fFrom}
				onchange={applyFilters}
				class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
				placeholder="จาก"
			/>

			<input
				type="date"
				bind:value={fTo}
				onchange={applyFilters}
				class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
				placeholder="ถึง"
			/>

			{#if tags.length > 0}
				<select
					bind:value={fTag}
					onchange={applyFilters}
					class="bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-sm text-white"
				>
					<option value="">ทุก Tag</option>
					{#each tags as tag}
						<option value={tag.id}>{tag.name}</option>
					{/each}
				</select>
			{/if}
		</div>

		{#if hasFilters}
			<button
				type="button"
				onclick={clearFilters}
				class="mt-2 text-xs text-gray-400 hover:text-white"
			>
				ล้างตัวกรอง
			</button>
		{/if}
	</div>

	<!-- Stats summary -->
	<div class="flex items-center justify-between text-sm text-gray-400">
		<span>{total} trades{hasFilters ? ' (กรองแล้ว)' : ''}</span>
		{#if totalPages > 1}
			<span>หน้า {currentPage}/{totalPages}</span>
		{/if}
	</div>

	<!-- Trade Table -->
	{#if trades.length === 0}
		<div class="card">
			<EmptyState message={hasFilters ? 'ไม่พบ trade ตามเงื่อนไข' : 'ยังไม่มี trade'} />
		</div>
	{:else}
		<div class="card overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-500 text-xs">
						<th class="text-left py-2">Symbol</th>
						<th class="text-left py-2">Type</th>
						<th class="text-right py-2">Lots</th>
						<th class="text-right py-2">Open</th>
						<th class="text-right py-2">Close</th>
						<th class="text-right py-2">P/L</th>
						<th class="text-right py-2 hidden md:table-cell">Duration</th>
						<th class="text-left py-2 hidden lg:table-cell">Tags</th>
						<th class="text-center py-2 hidden lg:table-cell">Note</th>
						<th class="text-right py-2">Time</th>
					</tr>
				</thead>
				<tbody>
					{#each trades as trade}
						<tr
							class="border-b border-dark-border/50 hover:bg-dark-border/20 cursor-pointer transition-colors"
							onclick={() => goto(`/portfolio/trades/${trade.id}`)}
						>
							<td class="py-2 text-white font-medium">{trade.symbol}</td>
							<td class="py-2">
								<span class="text-xs px-1.5 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
									{trade.type}
								</span>
							</td>
							<td class="py-2 text-right text-gray-300">{trade.lot_size}</td>
							<td class="py-2 text-right text-gray-300">{formatNumber(trade.open_price, 5)}</td>
							<td class="py-2 text-right text-gray-300">{formatNumber(trade.close_price, 5)}</td>
							<td class="py-2 text-right font-medium {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
								{formatCurrency(trade.profit)}
							</td>
							<td class="py-2 text-right text-gray-500 text-xs hidden md:table-cell">
								{getDuration(trade.open_time, trade.close_time)}
							</td>
							<td class="py-2 hidden lg:table-cell">
								<div class="flex gap-1 flex-wrap">
									{#each (trade.trade_tag_assignments || []) as assignment}
										{#if assignment.trade_tags}
											<TagPill
												name={assignment.trade_tags.name}
												color={assignment.trade_tags.color}
											/>
										{/if}
									{/each}
								</div>
							</td>
							<td class="py-2 text-center hidden lg:table-cell">
								{#if trade.trade_notes?.length > 0}
									<span class="text-xs text-yellow-400" title="มีบันทึก">📝</span>
								{/if}
							</td>
							<td class="py-2 text-right text-gray-500 text-xs">{formatDateTime(trade.close_time)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2">
				<button
					type="button"
					onclick={() => goToPage(currentPage - 1)}
					disabled={currentPage <= 1}
					class="px-3 py-1.5 text-sm rounded border border-dark-border text-gray-400 hover:text-white disabled:opacity-30"
				>
					← ก่อนหน้า
				</button>

				{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
					const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
					return start + i;
				}).filter(p => p <= totalPages) as p}
					<button
						type="button"
						onclick={() => goToPage(p)}
						class="px-3 py-1.5 text-sm rounded border {p === currentPage ? 'border-brand-primary text-brand-primary' : 'border-dark-border text-gray-400 hover:text-white'}"
					>
						{p}
					</button>
				{/each}

				<button
					type="button"
					onclick={() => goToPage(currentPage + 1)}
					disabled={currentPage >= totalPages}
					class="px-3 py-1.5 text-sm rounded border border-dark-border text-gray-400 hover:text-white disabled:opacity-30"
				>
					ถัดไป →
				</button>
			</div>
		{/if}
	{/if}
</div>
