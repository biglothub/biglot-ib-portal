<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import TagPill from '$lib/components/shared/TagPill.svelte';
	import { formatCurrency, formatNumber, formatDateTime } from '$lib/utils';

	let { data } = $props();
	let { trade, relatedTrades } = $derived(data);
	let tags = $derived(data.tags || []);

	// Note editor state
	let noteContent = $state('');
	let noteRating = $state<number | null>(null);
	let savingNote = $state(false);
	let noteSaved = $state(false);

	// Tag assignment state
	let showTagDropdown = $state(false);
	let assigningTag = $state(false);

	const assignedTagIds = $derived(
		new Set((trade?.trade_tag_assignments || []).map((a: any) => a.tag_id))
	);

	const availableTags = $derived(
		tags.filter((t: any) => !assignedTagIds.has(t.id))
	);

	$effect(() => {
		noteContent = trade?.trade_notes?.[0]?.content || '';
		noteRating = trade?.trade_notes?.[0]?.rating || null;
	});

	function getDuration(openTime: string, closeTime: string): string {
		const ms = new Date(closeTime).getTime() - new Date(openTime).getTime();
		const mins = Math.floor(ms / 60000);
		if (mins < 60) return `${mins} นาที`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours} ชม. ${mins % 60} นาที`;
		const days = Math.floor(hours / 24);
		return `${days} วัน ${hours % 24} ชม.`;
	}

	function getSession(closeTime: string): string {
		const hour = new Date(closeTime).getUTCHours();
		if (hour >= 0 && hour < 8) return 'Asian';
		if (hour >= 8 && hour < 15) return 'London';
		return 'New York';
	}

	async function saveNote() {
		if (!trade) return;
		savingNote = true;
		noteSaved = false;

		try {
			const res = await fetch(`/api/portfolio/trades/${trade.id}/notes`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: noteContent, rating: noteRating })
			});

			if (res.ok) {
				noteSaved = true;
				setTimeout(() => noteSaved = false, 2000);
			}
		} finally {
			savingNote = false;
		}
	}

	async function assignTag(tagId: string) {
		if (!trade) return;
		assigningTag = true;

		try {
			await fetch(`/api/portfolio/trades/${trade.id}/tags`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tag_id: tagId })
			});
			showTagDropdown = false;
			invalidateAll();
		} finally {
			assigningTag = false;
		}
	}

	async function removeTag(tagId: string) {
		if (!trade) return;

		await fetch(`/api/portfolio/trades/${trade.id}/tags`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tag_id: tagId })
		});
		invalidateAll();
	}
</script>

<div class="space-y-6">
	<!-- Back button -->
	<button
		type="button"
		onclick={() => goto('/portfolio/trades')}
		class="text-sm text-gray-400 hover:text-white flex items-center gap-1"
	>
		← กลับไป Trades
	</button>

	{#if !trade}
		<div class="card text-center py-12">
			<p class="text-gray-500">ไม่พบ Trade นี้</p>
		</div>
	{:else}
		<!-- Trade Header -->
		<div class="card">
			<div class="flex items-start justify-between mb-4">
				<div>
					<h2 class="text-lg font-bold text-white flex items-center gap-2">
						{trade.symbol}
						<span class="text-sm px-2 py-0.5 rounded {trade.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
							{trade.type}
						</span>
					</h2>
					<p class="text-xs text-gray-500 mt-1">{getSession(trade.close_time)} Session</p>
				</div>
				<div class="text-right">
					<p class="text-2xl font-bold {trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(trade.profit)}
					</p>
					{#if trade.pips != null}
						<p class="text-xs text-gray-500">{formatNumber(trade.pips, 1)} pips</p>
					{/if}
				</div>
			</div>

			<!-- Trade Details Grid -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
				<div>
					<p class="text-gray-500 text-xs">Lot Size</p>
					<p class="text-white">{trade.lot_size}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">Duration</p>
					<p class="text-white">{getDuration(trade.open_time, trade.close_time)}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">Open Price</p>
					<p class="text-white">{formatNumber(trade.open_price, 5)}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">Close Price</p>
					<p class="text-white">{formatNumber(trade.close_price, 5)}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">Open Time</p>
					<p class="text-white text-xs">{formatDateTime(trade.open_time)}</p>
				</div>
				<div>
					<p class="text-gray-500 text-xs">Close Time</p>
					<p class="text-white text-xs">{formatDateTime(trade.close_time)}</p>
				</div>
				{#if trade.sl != null}
					<div>
						<p class="text-gray-500 text-xs">Stop Loss</p>
						<p class="text-red-400">{formatNumber(trade.sl, 5)}</p>
					</div>
				{/if}
				{#if trade.tp != null}
					<div>
						<p class="text-gray-500 text-xs">Take Profit</p>
						<p class="text-green-400">{formatNumber(trade.tp, 5)}</p>
					</div>
				{/if}
				{#if trade.commission}
					<div>
						<p class="text-gray-500 text-xs">Commission</p>
						<p class="text-gray-300">{formatCurrency(trade.commission)}</p>
					</div>
				{/if}
				{#if trade.swap}
					<div>
						<p class="text-gray-500 text-xs">Swap</p>
						<p class="text-gray-300">{formatCurrency(trade.swap)}</p>
					</div>
				{/if}
			</div>

			{#if trade.commission || trade.swap}
				<div class="mt-3 pt-3 border-t border-dark-border flex items-center gap-4 text-sm">
					<span class="text-gray-500">Net P/L:</span>
					<span class="font-bold {(trade.profit + (trade.commission || 0) + (trade.swap || 0)) >= 0 ? 'text-green-400' : 'text-red-400'}">
						{formatCurrency(trade.profit + (trade.commission || 0) + (trade.swap || 0))}
					</span>
				</div>
			{/if}
		</div>

		<!-- Tags Section -->
		<div class="card">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-medium text-gray-400">Tags</h3>
				<div class="relative">
					<button
						type="button"
						onclick={() => showTagDropdown = !showTagDropdown}
						class="text-xs text-brand-primary hover:text-brand-primary/80"
					>
						+ เพิ่ม Tag
					</button>

					{#if showTagDropdown && availableTags.length > 0}
						<div class="absolute right-0 top-6 z-10 bg-dark-surface border border-dark-border rounded-lg shadow-lg p-2 min-w-[200px]">
							{#each availableTags as tag}
								<button
									type="button"
									onclick={() => assignTag(tag.id)}
									disabled={assigningTag}
									class="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-dark-border/50 rounded flex items-center gap-2"
								>
									<span class="w-3 h-3 rounded-full" style="background-color: {tag.color}"></span>
									{tag.name}
									<span class="text-[10px] text-gray-500 ml-auto">{tag.category}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap gap-1.5">
				{#each (trade.trade_tag_assignments || []) as assignment}
					{#if assignment.trade_tags}
						<TagPill
							name={assignment.trade_tags.name}
							color={assignment.trade_tags.color}
							category={assignment.trade_tags.category}
							removable={true}
							onremove={() => removeTag(assignment.tag_id)}
						/>
					{/if}
				{/each}

				{#if (trade.trade_tag_assignments || []).length === 0}
					<p class="text-xs text-gray-500">ยังไม่มี Tag — คลิก "+ เพิ่ม Tag" เพื่อจัดหมวดหมู่</p>
				{/if}
			</div>
		</div>

		<!-- Trade Notes -->
		<div class="card">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-medium text-gray-400">บันทึก</h3>
				{#if noteSaved}
					<span class="text-xs text-green-400">บันทึกแล้ว!</span>
				{/if}
			</div>

			<!-- Rating -->
			<div class="flex items-center gap-1 mb-3">
				<span class="text-xs text-gray-500 mr-2">คะแนน:</span>
				{#each [1, 2, 3, 4, 5] as star}
					<button
						type="button"
						onclick={() => noteRating = noteRating === star ? null : star}
						class="text-lg transition-transform hover:scale-110 {noteRating && noteRating >= star ? 'opacity-100' : 'opacity-30'}"
					>
						⭐
					</button>
				{/each}
			</div>

			<textarea
				bind:value={noteContent}
				placeholder="จดบันทึกเกี่ยวกับ trade นี้... เช่น ทำไมเข้า, อะไรที่ทำถูก/ผิด, บทเรียนที่ได้"
				rows="4"
				class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-y"
			></textarea>

			<button
				type="button"
				onclick={saveNote}
				disabled={savingNote}
				class="mt-2 btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
			>
				{savingNote ? 'กำลังบันทึก...' : 'บันทึก'}
			</button>
		</div>

		<!-- Related Trades -->
		{#if relatedTrades.length > 0}
			<div class="card">
				<h3 class="text-sm font-medium text-gray-400 mb-3">Trades อื่นของ {trade.symbol}</h3>
				<div class="space-y-2">
					{#each relatedTrades as rt}
						<a
							href="/portfolio/trades/{rt.id}"
							class="flex items-center justify-between p-2 rounded hover:bg-dark-border/30 transition-colors"
						>
							<div class="flex items-center gap-2">
								<span class="text-xs px-1.5 py-0.5 rounded {rt.type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
									{rt.type}
								</span>
								<span class="text-sm text-gray-300">{rt.lot_size} lots</span>
							</div>
							<div class="flex items-center gap-3">
								<span class="text-sm font-medium {rt.profit >= 0 ? 'text-green-400' : 'text-red-400'}">
									{formatCurrency(rt.profit)}
								</span>
								<span class="text-xs text-gray-500">{formatDateTime(rt.close_time)}</span>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
