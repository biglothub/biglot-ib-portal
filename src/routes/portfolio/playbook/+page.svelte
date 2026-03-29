<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import { addPendingDelete, getPendingDeletes } from '$lib/stores/undoQueue.svelte';
	import ChecklistEditor from '$lib/components/portfolio/ChecklistEditor.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency } from '$lib/utils';
	import type { Playbook, TradeTag } from '$lib/types';

	type PlaybookTemplate = { id: string; name: string; description?: string; category: string; author_id?: string; author_name?: string; total_trades: number; win_rate: number; net_pnl: number; clone_count: number; rating_sum?: number; rating_count?: number; entry_criteria?: string[]; exit_criteria?: string[]; risk_rules?: string[] };

	let { data } = $props();
	let playbooks = $derived(data.playbooks || []);
	let setupPerformance = $derived(data.setupPerformance || []);
	let tags = $derived(data.tags || []);
	let trades = $derived(data.trades || []);
	let templates = $derived(data.templates || []);
	let clonedTemplateIds = $derived(new Set(data.clonedTemplateIds || []));

	// Tab state
	type TabId = 'my' | 'community';
	let activeTab = $state<TabId>('my');

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
	let saving = $state(false);
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

	// Community tab state
	let searchQuery = $state('');
	let sortBy = $state<'popular' | 'newest' | 'win_rate'>('popular');
	let filterCategory = $state('all');
	let cloningId = $state('');
	let publishingId = $state('');
	let publishCategory = $state('general');
	let showPublishModal = $state(false);
	let publishPlaybookId = $state('');

	const categories = [
		{ value: 'all', label: 'ทั้งหมด' },
		{ value: 'general', label: 'ทั่วไป' },
		{ value: 'scalping', label: 'Scalping' },
		{ value: 'day_trading', label: 'Day Trading' },
		{ value: 'swing', label: 'Swing Trading' },
		{ value: 'breakout', label: 'Breakout' },
		{ value: 'reversal', label: 'Reversal' },
		{ value: 'trend', label: 'Trend Following' },
		{ value: 'news', label: 'News Trading' }
	];

	// Filtered templates
	let filteredTemplates = $derived.by(() => {
		let result = templates;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter((t: PlaybookTemplate) =>
				t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
			);
		}
		if (filterCategory !== 'all') {
			result = result.filter((t: PlaybookTemplate) => t.category === filterCategory);
		}
		return result;
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
		activeTab = 'my';
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
		actionError = '';

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
				resetForm();
				invalidate('portfolio:baseData');
			} else {
				actionError = 'ไม่สามารถบันทึก Playbook ได้';
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
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

	function openPublishModal(playbookId: string) {
		publishPlaybookId = playbookId;
		publishCategory = 'general';
		showPublishModal = true;
	}

	async function publishPlaybook() {
		if (!publishPlaybookId) return;
		publishingId = publishPlaybookId;
		actionError = '';

		try {
			const res = await fetch('/api/portfolio/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					playbook_id: publishPlaybookId,
					category: publishCategory
				})
			});

			if (res.status === 409) {
				actionError = 'Playbook นี้ถูกเผยแพร่แล้ว';
			} else if (!res.ok) {
				actionError = 'ไม่สามารถเผยแพร่ได้';
			} else {
				showPublishModal = false;
				invalidate('portfolio:baseData');
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			publishingId = '';
		}
	}

	async function cloneTemplate(templateId: string) {
		cloningId = templateId;
		actionError = '';

		try {
			const res = await fetch('/api/portfolio/templates/clone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ template_id: templateId })
			});

			if (res.status === 409) {
				actionError = 'คุณคัดลอกเทมเพลตนี้แล้ว';
			} else if (!res.ok) {
				actionError = 'ไม่สามารถคัดลอกได้';
			} else {
				invalidate('portfolio:baseData');
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			cloningId = '';
		}
	}

	async function unpublishTemplate(templateId: string) {
		if (!confirm('ต้องการยกเลิกการเผยแพร่ template นี้ใช่ไหม?')) return;
		actionError = '';

		try {
			const res = await fetch('/api/portfolio/templates', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: templateId })
			});
			if (!res.ok) {
				actionError = 'ไม่สามารถยกเลิกได้';
				return;
			}
			invalidate('portfolio:baseData');
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		}
	}

	function getCategoryLabel(value: string) {
		return categories.find(c => c.value === value)?.label || value;
	}

	function getRatingStars(template: PlaybookTemplate) {
		if (!template.rating_count) return 0;
		return Math.round(((template.rating_sum ?? 0) / template.rating_count) * 10) / 10;
	}
</script>

<div class="space-y-6">
	{#if actionError}
		<div class="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center justify-between">
			<span>{actionError}</span>
			<button type="button" onclick={() => actionError = ''} class="text-red-300 hover:text-red-200 text-xs">ปิด</button>
		</div>
	{/if}

	<!-- Tab Navigation -->
	<div class="flex items-center gap-1 border-b border-dark-border">
		<button
			onclick={() => activeTab = 'my'}
			class="px-4 py-2.5 text-sm font-medium transition-colors
				{activeTab === 'my'
					? 'text-brand-primary border-b-2 border-brand-primary'
					: 'text-gray-400 hover:text-gray-300'}"
		>
			Playbook ของฉัน
			<span class="ml-1 text-xs text-gray-400">({playbooks.length})</span>
		</button>
		<button
			onclick={() => activeTab = 'community'}
			class="px-4 py-2.5 text-sm font-medium transition-colors
				{activeTab === 'community'
					? 'text-brand-primary border-b-2 border-brand-primary'
					: 'text-gray-400 hover:text-gray-300'}"
		>
			เทมเพลตชุมชน
			<span class="ml-1 text-xs text-gray-400">({templates.length})</span>
		</button>
	</div>

	<!-- MY PLAYBOOKS TAB -->
	{#if activeTab === 'my'}
		<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
			<div class="card space-y-4">
				<div>
					<h2 class="text-lg font-semibold text-white">ตัวแก้ไข Playbook</h2>
					<p class="text-sm text-gray-400 mt-1">กำหนด Setup, กฎ, กระบวนการจัดการความเสี่ยง และเทรดตัวอย่าง</p>
				</div>

				<input bind:value={name} placeholder="ชื่อ Playbook" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
				<textarea bind:value={description} rows="3" placeholder="คำอธิบาย" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"></textarea>
				<select bind:value={setupTagId} class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					<option value="">ไม่มี Setup Tag</option>
					{#each tags.filter((tag: TradeTag) => tag.category === 'setup') as tag}
						<option value={tag.id}>{tag.name}</option>
					{/each}
				</select>

				<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
					<div class="card p-4 bg-dark-bg/20">
						<ChecklistEditor items={entryCriteria} label="เงื่อนไขเข้าเทรด" onchange={(items) => (entryCriteria = items)} />
					</div>
					<div class="card p-4 bg-dark-bg/20">
						<ChecklistEditor items={exitCriteria} label="เงื่อนไขออกเทรด" onchange={(items) => (exitCriteria = items)} />
					</div>
					<div class="card p-4 bg-dark-bg/20">
						<ChecklistEditor items={riskRules} label="กฎจัดการความเสี่ยง" onchange={(items) => (riskRules = items)} />
					</div>
					<div class="card p-4 bg-dark-bg/20">
						<ChecklistEditor items={mistakesToAvoid} label="ข้อผิดพลาดที่ต้องหลีกเลี่ยง" onchange={(items) => (mistakesToAvoid = items)} />
					</div>
				</div>

				<div>
					<label for="example-trades" class="text-xs text-gray-400 mb-2 block">เทรดตัวอย่าง (ล่าสุด 100 รายการ)</label>
					<select id="example-trades" multiple bind:value={exampleTradeIds} class="w-full min-h-32 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
						{#each trades.slice(0, 100) as trade}
							<option value={trade.id}>
								{trade.symbol} • {trade.type} • {formatCurrency(trade.profit)}
							</option>
						{/each}
					</select>
				</div>

				<label class="flex items-center gap-2 text-sm text-gray-300">
					<input type="checkbox" bind:checked={isActive} />
					เปิดใช้งาน
				</label>

				<div class="flex items-center gap-3">
					<button type="button" onclick={savePlaybook} disabled={saving} class="btn-primary text-sm py-2 px-5 disabled:opacity-50 inline-flex items-center gap-2">
						{#if saving}
							<svg class="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
							กำลังบันทึก...
						{:else}
							{editingId ? 'อัปเดต Playbook' : 'สร้าง Playbook'}
						{/if}
					</button>
					<button type="button" onclick={resetForm} class="text-sm text-gray-400 hover:text-white">
						รีเซ็ต
					</button>
				</div>
			</div>

			<div class="card">
				<div class="flex items-center justify-between mb-4">
					<div>
						<h2 class="text-lg font-semibold text-white">คลัง Playbook</h2>
						<p class="text-sm text-gray-400 mt-1">{playbooks.length} playbooks</p>
					</div>
				</div>

				{#if playbooks.length === 0}
					<EmptyState message="ยังไม่มี playbook" />
				{:else}
					<div class="space-y-3">
						{#each playbooks.filter((p: Playbook) => !hiddenPlaybookIds.has(p.id)) as playbook}
							<div class="rounded-xl border border-dark-border bg-dark-bg/20 p-4">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2 flex-wrap">
											<h3 class="text-white font-medium truncate">{playbook.name}</h3>
											<span class="text-[10px] px-2 py-1 rounded-full shrink-0 {playbook.is_active ? 'bg-green-500/10 text-green-300' : 'bg-gray-500/10 text-gray-400'}">
												{playbook.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
											</span>
										</div>
										<p class="mt-1 text-sm text-gray-400 truncate">{playbook.description || 'ไม่มีคำอธิบาย'}</p>
									</div>
									<div class="flex items-center gap-2 shrink-0">
										<button type="button" onclick={() => openPublishModal(playbook.id)} class="text-xs text-purple-400 hover:text-purple-300" title="เผยแพร่เป็น Template">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
											</svg>
										</button>
										<button type="button" onclick={() => editPlaybook(playbook)} class="text-xs text-brand-primary">แก้ไข</button>
										<button type="button" onclick={() => deletePlaybook(playbook.id)} class="text-xs text-red-300">ลบ</button>
									</div>
								</div>
								<div class="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-400">
									<div>{playbook.entry_criteria?.length || 0} เงื่อนไขเข้า</div>
									<div>{playbook.risk_rules?.length || 0} กฎความเสี่ยง</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Setup Performance -->
		<div class="card">
			<h2 class="text-lg font-semibold text-white mb-4">ภาพรวมผลงาน Setup</h2>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-dark-border text-gray-400 text-xs">
							<th class="text-left py-2">Setup</th>
							<th class="text-right py-2">เทรด</th>
							<th class="text-right py-2">รีวิวแล้ว</th>
							<th class="text-right py-2">อัตราชนะ</th>
							<th class="text-right py-2">ค่าคาดหวัง</th>
							<th class="text-right py-2">กำไร/ขาดทุน</th>
						</tr>
					</thead>
					<tbody>
						{#each setupPerformance as setup}
							<tr class="border-b border-dark-border/40">
								<td class="py-2 text-white">{setup.name}</td>
								<td class="py-2 text-right text-gray-300">{setup.totalTrades}</td>
								<td class="py-2 text-right text-gray-300">{setup.reviewedTrades}</td>
								<td class="py-2 text-right text-gray-300">{setup.winRate.toFixed(0)}%</td>
								<td class="py-2 text-right {setup.expectancy >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.expectancy)}</td>
								<td class="py-2 text-right font-medium {setup.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(setup.totalProfit)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- COMMUNITY TEMPLATES TAB -->
	{#if activeTab === 'community'}
		<!-- Filters + Search -->
		<div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
			<div class="relative flex-1 w-full sm:w-auto">
				<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
				<input
					bind:value={searchQuery}
					placeholder="ค้นหาเทมเพลต..."
					class="w-full bg-dark-bg border border-dark-border rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder-gray-500"
				/>
			</div>
			<select bind:value={filterCategory} class="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white">
				{#each categories as cat}
					<option value={cat.value}>{cat.label}</option>
				{/each}
			</select>
			<select bind:value={sortBy} class="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white">
				<option value="popular">ยอดนิยม</option>
				<option value="newest">ล่าสุด</option>
				<option value="win_rate">อัตราชนะสูงสุด</option>
			</select>
		</div>

		<!-- Template Grid -->
		{#if filteredTemplates.length === 0}
			<EmptyState message="ยังไม่มีเทมเพลตในหมวดนี้" />
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
				{#each filteredTemplates as template}
					{@const isCloned = clonedTemplateIds.has(template.id)}
					{@const isOwn = template.author_id === data.playbooks?.[0]?.user_id}
					<div class="card group hover:border-brand-primary/30 transition-colors">
						<!-- Header -->
						<div class="flex items-start justify-between gap-2 mb-3">
							<div class="min-w-0 flex-1">
								<h3 class="text-white font-medium truncate">{template.name}</h3>
								<p class="text-xs text-gray-400 mt-0.5 truncate">
									โดย {template.author_name || 'ไม่ระบุชื่อ'}
								</p>
							</div>
							<span class="shrink-0 text-[10px] px-2 py-1 rounded-full bg-purple-500/10 text-purple-300">
								{getCategoryLabel(template.category)}
							</span>
						</div>

						<!-- Description -->
						{#if template.description}
							<p class="text-sm text-gray-400 mb-3 line-clamp-2">{template.description}</p>
						{/if}

						<!-- Stats -->
						<div class="grid grid-cols-3 gap-2 mb-3">
							<div class="text-center p-2 rounded-lg bg-dark-bg/40">
								<div class="text-xs text-gray-400">เทรด</div>
								<div class="text-sm font-medium text-white">{template.total_trades}</div>
							</div>
							<div class="text-center p-2 rounded-lg bg-dark-bg/40">
								<div class="text-xs text-gray-400">อัตราชนะ</div>
								<div class="text-sm font-medium {template.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}">
									{template.win_rate.toFixed(1)}%
								</div>
							</div>
							<div class="text-center p-2 rounded-lg bg-dark-bg/40">
								<div class="text-xs text-gray-400">P&L</div>
								<div class="text-sm font-medium {template.net_pnl >= 0 ? 'text-green-400' : 'text-red-400'}">
									{formatCurrency(template.net_pnl)}
								</div>
							</div>
						</div>

						<!-- Rules preview -->
						<div class="flex flex-wrap gap-1.5 mb-3">
							{#if (template.entry_criteria?.length || 0) > 0}
								<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300">
									{template.entry_criteria.length} เงื่อนไขเข้า
								</span>
							{/if}
							{#if (template.exit_criteria?.length || 0) > 0}
								<span class="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-300">
									{template.exit_criteria.length} เงื่อนไขออก
								</span>
							{/if}
							{#if (template.risk_rules?.length || 0) > 0}
								<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">
									{template.risk_rules.length} กฎความเสี่ยง
								</span>
							{/if}
						</div>

						<!-- Footer -->
						<div class="flex items-center justify-between pt-3 border-t border-dark-border/40">
							<div class="flex items-center gap-3 text-xs text-gray-400">
								<span class="flex items-center gap-1">
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
									</svg>
									{template.clone_count} ครั้ง
								</span>
							</div>
							{#if isOwn}
								<button
									type="button"
									onclick={() => unpublishTemplate(template.id)}
									class="text-xs text-red-400 hover:text-red-300 transition-colors"
								>
									ยกเลิกเผยแพร่
								</button>
							{:else if isCloned}
								<span class="text-xs text-green-400 flex items-center gap-1">
									<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
									</svg>
									คัดลอกแล้ว
								</span>
							{:else}
								<button
									type="button"
									onclick={() => cloneTemplate(template.id)}
									disabled={cloningId === template.id}
									class="flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors disabled:opacity-50"
								>
									{#if cloningId === template.id}
										<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
										</svg>
										กำลังคัดลอก...
									{:else}
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
										</svg>
										คัดลอกมาใช้
									{/if}
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Publish Modal -->
{#if showPublishModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<!-- Backdrop -->
		<button
			transition:fade={{ duration: 200 }}
			type="button"
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={() => showPublishModal = false}
			aria-label="ปิด"
		></button>
		<!-- Modal -->
		<div transition:fly={{ y: 30, duration: 250 }} class="relative w-full max-w-md rounded-2xl border border-dark-border bg-dark-surface p-6 space-y-4 shadow-2xl">
			<h3 class="text-lg font-semibold text-white">เผยแพร่เป็นเทมเพลตชุมชน</h3>
			<p class="text-sm text-gray-400">
				Playbook ของคุณจะถูกแชร์ให้ผู้ใช้คนอื่นดูและคัดลอกได้ สถิติผลงานจะถูกบันทึกจากข้อมูลปัจจุบัน
			</p>

			<div>
				<label for="publish-category" class="text-xs text-gray-400 mb-1 block">หมวดหมู่</label>
				<select id="publish-category" bind:value={publishCategory} class="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white">
					{#each categories.filter(c => c.value !== 'all') as cat}
						<option value={cat.value}>{cat.label}</option>
					{/each}
				</select>
			</div>

			<div class="flex items-center justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={() => showPublishModal = false}
					class="text-sm text-gray-400 hover:text-white transition-colors"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={publishPlaybook}
					disabled={!!publishingId}
					class="btn-primary text-sm py-2 px-5 disabled:opacity-50 inline-flex items-center gap-2"
				>
					{#if publishingId}
						<svg class="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
						กำลังเผยแพร่...
					{:else}
						เผยแพร่
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
