<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { addPendingDelete, getPendingDeletes } from '$lib/stores/undoQueue.svelte';
	import { toast, formatSavedTime } from '$lib/stores/toast.svelte';
	import ChecklistEditor from '$lib/components/portfolio/ChecklistEditor.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency } from '$lib/utils';
	import type { Playbook, TradeTag } from '$lib/types';

	let { data } = $props();
	let playbooks = $derived(data.playbooks || []);
	let setupPerformance = $derived(data.setupPerformance || []);
	let tags = $derived(data.tags || []);
	let trades = $derived(data.trades || []);

	// Editor state
	let editingId = $state('');
	let name = $state('');
	let description = $state('');
	let setupTagId = $state('');
	let entryCriteria = $state<string[]>([]);
	let exitCriteria = $state<string[]>([]);
	let riskRules = $state<string[]>([]);
	let mistakesToAvoid = $state<string[]>([]);
	let exampleTradeIds = $state<string[]>([]);
	let isActive = $state(true);
	let activeTab = $state<'entry' | 'exit' | 'risk' | 'mistakes'>('entry');
	let saving = $state(false);
	let saveSuccess = $state(false);
	let lastSavedAt = $state<Date | null>(null);
	let lastSavedName = $state('');
	let highlightedId = $state('');
	let actionError = $state('');
	let hiddenPlaybookIds = $state<Set<string>>(new Set());
	let pendingPlaybookDeleteIds = $state<Map<string, string>>(new Map());

	// Restore hidden playbook if its pending delete was cancelled
	$effect(() => {
		const currentPendingIds = new Set(getPendingDeletes().map((d) => d.id));
		// Snapshot current state to avoid mutating reactive values we're reading
		const pendingEntries = [...pendingPlaybookDeleteIds.entries()];
		const toRestore: string[] = [];
		for (const [playbookId, pendingId] of pendingEntries) {
			if (!currentPendingIds.has(pendingId)) {
				toRestore.push(playbookId);
			}
		}
		if (toRestore.length > 0) {
			// Batch mutations to avoid cascading re-renders
			const restoreSet = new Set(toRestore);
			hiddenPlaybookIds = new Set([...hiddenPlaybookIds].filter((id) => !restoreSet.has(id)));
			pendingPlaybookDeleteIds = new Map(pendingEntries.filter(([k]) => !restoreSet.has(k)));
		}
	});

	function editPlaybook(playbook: Playbook) {
		editingId = playbook.id;
		name = playbook.name || '';
		description = playbook.description || '';
		setupTagId = playbook.setup_tag_id || '';
		entryCriteria = playbook.entry_criteria || [];
		exitCriteria = playbook.exit_criteria || [];
		riskRules = playbook.risk_rules || [];
		mistakesToAvoid = playbook.mistakes_to_avoid || [];
		exampleTradeIds = playbook.example_trade_ids || [];
		isActive = playbook.is_active !== false;
	}

	function resetForm() {
		editingId = '';
		name = '';
		description = '';
		setupTagId = '';
		entryCriteria = [];
		exitCriteria = [];
		riskRules = [];
		mistakesToAvoid = [];
		exampleTradeIds = [];
		isActive = true;
	}

	async function savePlaybook() {
		if (!name.trim()) return;
		saving = true;
		saveSuccess = false;
		actionError = '';
		const isNew = !editingId;
		const savedName = name.trim();

		try {
			const res = await fetch('/api/portfolio/playbooks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editingId || undefined,
					name,
					description,
					setup_tag_id: setupTagId || null,
					entry_criteria: entryCriteria,
					exit_criteria: exitCriteria,
					risk_rules: riskRules,
					mistakes_to_avoid: mistakesToAvoid,
					example_trade_ids: exampleTradeIds,
					is_active: isActive
				})
			});

			if (res.ok) {
				const { playbook } = await res.json();
				lastSavedAt = new Date();
				lastSavedName = savedName;
				saveSuccess = true;

				// Highlight the saved item in the list
				highlightedId = playbook?.id || editingId;
				setTimeout(() => { highlightedId = ''; }, 3000);

				// Show global toast with confirmation
				toast.success(isNew ? 'สร้าง Playbook แล้ว' : 'อัปเดต Playbook แล้ว', {
					detail: savedName
				});

				await invalidate('portfolio:baseData');

				// Small delay so user can see the success state before form resets
				setTimeout(() => {
					saveSuccess = false;
					if (isNew) resetForm();
				}, 1200);
			} else {
				const errData = await res.json().catch(() => ({}));
				actionError = errData.message || 'ไม่สามารถบันทึก Playbook ได้';
				toast.error('บันทึกไม่สำเร็จ', { detail: actionError });
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
			toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
		} finally {
			saving = false;
		}
	}

	function deletePlaybook(id: string) {
		const playbook = playbooks.find((p: Playbook) => p.id === id);
		const label = playbook?.name || 'Playbook';

		// Optimistic hide
		hiddenPlaybookIds = new Set([...hiddenPlaybookIds, id]);
		if (editingId === id) resetForm();

		const pendingId = addPendingDelete(`Playbook: ${label}`, async () => {
			pendingPlaybookDeleteIds = new Map([...pendingPlaybookDeleteIds].filter(([k]) => k !== id));
			try {
				const res = await fetch('/api/portfolio/playbooks', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id })
				});
				if (!res.ok) {
					actionError = 'ไม่สามารถลบ Playbook ได้';
				}
				await invalidate('portfolio:baseData');
			} catch {
				actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
			}
		});

		pendingPlaybookDeleteIds = new Map([...pendingPlaybookDeleteIds, [id, pendingId]]);
	}

</script>

<div class="space-y-6">
	{#if actionError}
		<div class="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center justify-between">
			<span>{actionError}</span>
			<button type="button" onclick={() => actionError = ''} class="text-red-300 hover:text-red-200 text-xs">ปิด</button>
		</div>
	{/if}

	<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
		<!-- Editor -->
		<div class="card space-y-4">
			<!-- Header -->
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold text-white">{editingId ? 'แก้ไข Playbook' : 'สร้าง Playbook ใหม่'}</h2>
				{#if editingId}
					<button type="button" onclick={resetForm} class="text-xs text-gray-500 hover:text-gray-300 transition-colors">
						+ สร้างใหม่
					</button>
				{/if}
			</div>

			<!-- Name + Status row -->
			<div class="flex gap-2">
				<input
					bind:value={name}
					placeholder="ชื่อ Playbook"
					class="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-primary/50 outline-none transition-colors"
				/>
				<button
					type="button"
					onclick={() => (isActive = !isActive)}
					class="shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-colors
						{isActive ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'border-dark-border text-gray-500 hover:text-gray-300'}"
				>
					{isActive ? 'เปิด' : 'ปิด'}
				</button>
			</div>

			<!-- Description + Tag row -->
			<div class="flex gap-2">
				<input
					bind:value={description}
					placeholder="คำอธิบาย (ไม่บังคับ)"
					class="flex-1 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-primary/50 outline-none transition-colors"
				/>
				<select
					bind:value={setupTagId}
					class="shrink-0 bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-brand-primary/50 outline-none transition-colors"
				>
					<option value="">ไม่มี Tag</option>
					{#each tags.filter((tag: TradeTag) => tag.category === 'setup') as tag}
						<option value={tag.id}>{tag.name}</option>
					{/each}
				</select>
			</div>

			<!-- Tabbed checklists -->
			<div>
				<div class="flex border-b border-dark-border/60 mb-3">
					{#each [
						{ id: 'entry', label: 'เข้าเทรด', count: entryCriteria.length },
						{ id: 'exit', label: 'ออกเทรด', count: exitCriteria.length },
						{ id: 'risk', label: 'ความเสี่ยง', count: riskRules.length },
						{ id: 'mistakes', label: 'ข้อผิดพลาด', count: mistakesToAvoid.length },
					] as tab}
						<button
							type="button"
							onclick={() => (activeTab = tab.id as typeof activeTab)}
							class="pb-2 px-3 text-xs transition-colors flex items-center gap-1.5
								{activeTab === tab.id
									? 'text-white border-b-2 border-brand-primary -mb-px'
									: 'text-gray-500 hover:text-gray-300'}"
						>
							{tab.label}
							{#if tab.count > 0}
								<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-dark-border text-gray-400">{tab.count}</span>
							{/if}
						</button>
					{/each}
				</div>

				{#if activeTab === 'entry'}
					<ChecklistEditor items={entryCriteria} label="" placeholder="เพิ่มเงื่อนไขเข้าเทรด..." onchange={(items) => (entryCriteria = items)} />
				{:else if activeTab === 'exit'}
					<ChecklistEditor items={exitCriteria} label="" placeholder="เพิ่มเงื่อนไขออกเทรด..." onchange={(items) => (exitCriteria = items)} />
				{:else if activeTab === 'risk'}
					<ChecklistEditor items={riskRules} label="" placeholder="เพิ่มกฎความเสี่ยง..." onchange={(items) => (riskRules = items)} />
				{:else}
					<ChecklistEditor items={mistakesToAvoid} label="" placeholder="เพิ่มข้อผิดพลาดที่ต้องหลีกเลี่ยง..." onchange={(items) => (mistakesToAvoid = items)} />
				{/if}
			</div>

			<!-- Save row -->
			<div class="flex items-center justify-between pt-1 border-t border-dark-border/40">
				{#if lastSavedAt}
					<p class="text-xs text-green-500/70 flex items-center gap-1">
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
						{formatSavedTime(lastSavedAt)} · {lastSavedName}
					</p>
				{:else}
					<span></span>
				{/if}
				<button
					type="button"
					onclick={savePlaybook}
					disabled={saving || !name.trim()}
					class="btn-primary text-sm py-1.5 px-4 disabled:opacity-40 inline-flex items-center gap-2 transition-all
						{saveSuccess ? '!bg-green-500 !text-white' : ''}"
				>
					{#if saving}
						<svg class="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
						กำลังบันทึก...
					{:else if saveSuccess}
						<svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
						บันทึกแล้ว!
					{:else}
						{editingId ? 'อัปเดต' : 'สร้าง'}
					{/if}
				</button>
			</div>
		</div>

		<!-- Library -->
		<div class="card">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-semibold text-white">คลัง Playbook</h2>
				<span class="text-xs text-gray-500">{playbooks.length} รายการ</span>
			</div>

			{#if playbooks.length === 0}
				<EmptyState message="ยังไม่มี playbook" />
			{:else}
				<div class="space-y-2">
					{#each playbooks.filter((p: Playbook) => !hiddenPlaybookIds.has(p.id)) as playbook}
						<div
							id="playbook-{playbook.id}"
							class="rounded-lg border px-4 py-3 transition-all duration-500 cursor-pointer hover:border-dark-border/80
								{highlightedId === playbook.id
									? 'border-green-500/50 bg-green-500/5'
									: editingId === playbook.id
									? 'border-brand-primary/40 bg-brand-primary/5'
									: 'border-dark-border/50 bg-dark-bg/20'}"
							role="button"
							tabindex="0"
							onclick={() => editPlaybook(playbook)}
							onkeydown={(e) => { if (e.key === 'Enter') editPlaybook(playbook); }}
						>
							<div class="flex items-center justify-between gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<h3 class="text-sm text-white font-medium truncate">{playbook.name}</h3>
										{#if !playbook.is_active}
											<span class="text-[10px] text-gray-500 shrink-0">ปิด</span>
										{/if}
									</div>
									{#if playbook.description}
										<p class="text-xs text-gray-500 truncate mt-0.5">{playbook.description}</p>
									{/if}
								</div>
								<div class="flex items-center gap-3 shrink-0 text-xs text-gray-500">
									<span>{playbook.entry_criteria?.length || 0} เงื่อนไข</span>
									<button
										type="button"
										onclick={(e) => { e.stopPropagation(); deletePlaybook(playbook.id); }}
										class="text-gray-600 hover:text-red-400 transition-colors"
										aria-label="ลบ"
									>
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Setup Performance -->
	{#if setupPerformance.length > 0}
		<div class="card">
			<h2 class="text-sm font-semibold text-white mb-4">ผลงานตาม Setup</h2>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-dark-border/60 text-gray-500 text-xs">
							<th class="text-left pb-2">Setup</th>
							<th class="text-right pb-2">เทรด</th>
							<th class="text-right pb-2">รีวิว</th>
							<th class="text-right pb-2">Win%</th>
							<th class="text-right pb-2">คาดหวัง</th>
							<th class="text-right pb-2">กำไร/ขาดทุน</th>
						</tr>
					</thead>
					<tbody>
						{#each setupPerformance as setup}
							<tr class="border-b border-dark-border/30 hover:bg-dark-border/10">
								<td class="py-2.5 text-white">{setup.name}</td>
								<td class="py-2.5 text-right text-gray-400">{setup.totalTrades}</td>
								<td class="py-2.5 text-right text-gray-400">{setup.reviewedTrades}</td>
								<td class="py-2.5 text-right text-gray-300">{setup.winRate.toFixed(0)}%</td>
								<td class="py-2.5 text-right {setup.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.expectancy)}</td>
								<td class="py-2.5 text-right font-medium {setup.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.totalProfit)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
