<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import ChecklistEditor from '$lib/components/portfolio/ChecklistEditor.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatCurrency } from '$lib/utils';

	let { data } = $props();
	let playbooks = $derived(data.playbooks || []);
	let setupPerformance = $derived(data.setupPerformance || []);
	let tags = $derived(data.tags || []);
	let trades = $derived(data.trades || []);

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

	function editPlaybook(playbook: any) {
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
				invalidateAll();
			} else {
				actionError = 'ไม่สามารถบันทึก Playbook ได้';
			}
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		} finally {
			saving = false;
		}
	}

	async function deletePlaybook(id: string) {
		if (!confirm('ต้องการลบ playbook นี้ใช่ไหม? ข้อมูลจะหายถาวร')) return;
		actionError = '';

		try {
			const res = await fetch('/api/portfolio/playbooks', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (!res.ok) {
				actionError = 'ไม่สามารถลบ Playbook ได้';
				return;
			}
			if (editingId === id) resetForm();
			invalidateAll();
		} catch {
			actionError = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
		}
	}
</script>

<div class="space-y-6">
	{#if actionError}
		<div class="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center justify-between">
			<span>{actionError}</span>
			<button type="button" onclick={() => actionError = ''} class="text-red-300 hover:text-red-200 text-xs">ปิด</button>
		</div>
	{/if}

	<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
		<div class="card space-y-4">
			<div>
				<h2 class="text-lg font-semibold text-white">Playbook Editor</h2>
				<p class="text-sm text-gray-500 mt-1">Define your setup, rules, risk process, and example trades.</p>
			</div>

			<input bind:value={name} placeholder="Playbook name" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white" />
			<textarea bind:value={description} rows="3" placeholder="Description" class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white"></textarea>
			<select bind:value={setupTagId} class="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
				<option value="">No setup tag</option>
				{#each tags.filter((tag: any) => tag.category === 'setup') as tag}
					<option value={tag.id}>{tag.name}</option>
				{/each}
			</select>

			<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
				<div class="card p-4 bg-dark-bg/20">
					<ChecklistEditor items={entryCriteria} label="Entry Criteria" onchange={(items) => (entryCriteria = items)} />
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<ChecklistEditor items={exitCriteria} label="Exit Criteria" onchange={(items) => (exitCriteria = items)} />
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<ChecklistEditor items={riskRules} label="Risk Rules" onchange={(items) => (riskRules = items)} />
				</div>
				<div class="card p-4 bg-dark-bg/20">
					<ChecklistEditor items={mistakesToAvoid} label="Mistakes To Avoid" onchange={(items) => (mistakesToAvoid = items)} />
				</div>
			</div>

			<div>
				<label for="example-trades" class="text-xs text-gray-500 mb-2 block">Example Trades</label>
				<select id="example-trades" multiple bind:value={exampleTradeIds} class="w-full min-h-32 bg-dark-bg border border-dark-border rounded px-3 py-2 text-sm text-white">
					{#each trades as trade}
						<option value={trade.id}>
							{trade.symbol} • {trade.type} • {formatCurrency(trade.profit)}
						</option>
					{/each}
				</select>
			</div>

			<label class="flex items-center gap-2 text-sm text-gray-300">
				<input type="checkbox" bind:checked={isActive} />
				Active
			</label>

			<div class="flex items-center gap-3">
				<button type="button" onclick={savePlaybook} disabled={saving} class="btn-primary text-sm py-2 px-5 disabled:opacity-50">
					{saving ? 'Saving...' : editingId ? 'Update Playbook' : 'Create Playbook'}
				</button>
				<button type="button" onclick={resetForm} class="text-sm text-gray-400 hover:text-white">
					Reset
				</button>
			</div>
		</div>

		<div class="card">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h2 class="text-lg font-semibold text-white">Playbook Library</h2>
					<p class="text-sm text-gray-500 mt-1">{playbooks.length} saved playbooks</p>
				</div>
			</div>

			{#if playbooks.length === 0}
				<EmptyState message="ยังไม่มี playbook" />
			{:else}
				<div class="space-y-3">
					{#each playbooks as playbook}
						<div class="rounded-2xl border border-dark-border bg-dark-bg/20 p-4">
							<div class="flex items-start justify-between gap-3">
								<div>
									<div class="flex items-center gap-2">
										<h3 class="text-white font-medium">{playbook.name}</h3>
										<span class="text-[10px] px-2 py-1 rounded-full {playbook.is_active ? 'bg-green-500/10 text-green-300' : 'bg-gray-500/10 text-gray-400'}">
											{playbook.is_active ? 'ACTIVE' : 'INACTIVE'}
										</span>
									</div>
									<p class="mt-1 text-sm text-gray-400">{playbook.description || 'No description'}</p>
								</div>
								<div class="flex items-center gap-3">
									<button type="button" onclick={() => editPlaybook(playbook)} class="text-xs text-brand-primary">Edit</button>
									<button type="button" onclick={() => deletePlaybook(playbook.id)} class="text-xs text-red-300">Delete</button>
								</div>
							</div>
							<div class="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
								<div>{playbook.entry_criteria?.length || 0} entry rules</div>
								<div>{playbook.risk_rules?.length || 0} risk rules</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="card">
		<h2 class="text-lg font-semibold text-white mb-4">Setup Performance Snapshot</h2>
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-dark-border text-gray-500 text-xs">
						<th class="text-left py-2">Setup</th>
						<th class="text-right py-2">Trades</th>
						<th class="text-right py-2">Reviewed</th>
						<th class="text-right py-2">Win Rate</th>
						<th class="text-right py-2">Expectancy</th>
						<th class="text-right py-2">P/L</th>
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
</div>
