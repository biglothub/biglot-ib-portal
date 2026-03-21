<script lang="ts">
	import { invalidate } from '$app/navigation';

	let {
		rules = [],
		completions = [],
		trades = [],
		date = new Date().toISOString().split('T')[0],
		onupdate
	}: {
		rules?: any[];
		completions?: any[];
		trades?: any[];
		date?: string;
		onupdate?: () => void;
	} = $props();

	let saving = $state(false);
	let newRuleName = $state('');
	let showAddRule = $state(false);

	// Get today's completions
	const todayCompletions = $derived(
		completions.filter((c: any) => c.date === date)
	);

	// Manual rules
	const manualRules = $derived(rules.filter((r: any) => r.type === 'manual'));
	const automatedRules = $derived(rules.filter((r: any) => r.type === 'automated'));

	// Check if a rule is completed today
	function isCompleted(ruleId: string) {
		return todayCompletions.some((c: any) => c.rule_id === ruleId && c.completed);
	}

	// Get auto value for a rule
	function getAutoValue(ruleId: string) {
		const c = todayCompletions.find((c: any) => c.rule_id === ruleId);
		return c?.auto_value;
	}

	// Count completed
	const completedCount = $derived(
		rules.filter((r: any) => isCompleted(r.id)).length
	);

	// Toggle a manual rule
	async function toggleRule(ruleId: string) {
		saving = true;
		const nowCompleted = !isCompleted(ruleId);
		try {
			await fetch('/api/portfolio/checklist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'toggle',
					rule_id: ruleId,
					date,
					completed: nowCompleted
				})
			});
			onupdate?.();
		} finally {
			saving = false;
		}
	}

	// Add new rule
	async function addRule() {
		if (!newRuleName.trim()) return;
		saving = true;
		try {
			await fetch('/api/portfolio/checklist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'add_rule',
					name: newRuleName.trim(),
					type: 'manual'
				})
			});
			newRuleName = '';
			showAddRule = false;
			onupdate?.();
		} finally {
			saving = false;
		}
	}

	// Start my day
	async function startMyDay() {
		saving = true;
		try {
			await fetch('/api/portfolio/checklist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start_day' })
			});
			onupdate?.();
		} finally {
			saving = false;
		}
	}

	// Auto rule status label
	function autoStatusLabel(rule: any) {
		const val = getAutoValue(rule.id);
		if (val === undefined || val === null) return 'รอตรวจสอบ';
		const cond = rule.condition || {};
		if (cond.unit === 'percent') return `${val}%`;
		if (cond.unit === 'usd') return `$${val}`;
		return val ? 'ผ่าน' : 'ไม่ผ่าน';
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-gray-400">เช็คลิสต์ประจำวัน</h3>
		<div class="flex items-center gap-2">
			<span class="text-xs text-gray-500">{completedCount}/{rules.length}</span>
			<div class="w-16 h-1.5 rounded-full bg-dark-border overflow-hidden">
				<div
					class="h-full rounded-full bg-brand-primary transition-all"
					style="width: {rules.length > 0 ? (completedCount / rules.length) * 100 : 0}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Manual Rules -->
	{#if manualRules.length > 0}
		<div class="text-[10px] uppercase tracking-wider text-gray-600 mt-2">ทำเอง</div>
		{#each manualRules as rule}
			<button
				onclick={() => toggleRule(rule.id)}
				disabled={saving}
				class="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors
					{isCompleted(rule.id) ? 'bg-green-500/10' : 'bg-dark-bg/30 hover:bg-dark-bg/50'}"
			>
				<div class="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
					{isCompleted(rule.id) ? 'border-green-500 bg-green-500' : 'border-gray-600'}">
					{#if isCompleted(rule.id)}
						<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
						</svg>
					{/if}
				</div>
				<span class="text-sm {isCompleted(rule.id) ? 'text-gray-400 line-through' : 'text-gray-200'}">
					{rule.name}
				</span>
			</button>
		{/each}
	{/if}

	<!-- Automated Rules -->
	{#if automatedRules.length > 0}
		<div class="text-[10px] uppercase tracking-wider text-gray-600 mt-3">อัตโนมัติ</div>
		{#each automatedRules as rule}
			<div class="flex items-center justify-between rounded-xl px-3 py-2.5
				{isCompleted(rule.id) ? 'bg-green-500/10' : 'bg-dark-bg/30'}">
				<div class="flex items-center gap-3">
					<div class="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
						{isCompleted(rule.id) ? 'border-green-500 bg-green-500' : 'border-gray-600'}">
						{#if isCompleted(rule.id)}
							<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
							</svg>
						{/if}
					</div>
					<span class="text-sm {isCompleted(rule.id) ? 'text-gray-400' : 'text-gray-200'}">{rule.name}</span>
				</div>
				<span class="text-xs {isCompleted(rule.id) ? 'text-green-400' : 'text-amber-400'}">
					{autoStatusLabel(rule)}
				</span>
			</div>
		{/each}
	{/if}

	<!-- Add rule -->
	{#if showAddRule}
		<div class="flex gap-2">
			<input
				bind:value={newRuleName}
				placeholder="ชื่อกฎ..."
				class="flex-1 rounded-lg bg-dark-bg border border-dark-border px-3 py-2 text-sm text-white placeholder-gray-600"
				onkeydown={(e) => { if (e.key === 'Enter') addRule(); }}
			/>
			<button onclick={addRule} disabled={saving} class="px-3 py-2 rounded-lg bg-brand-primary text-dark-bg text-sm font-medium">เพิ่ม</button>
			<button onclick={() => { showAddRule = false; newRuleName = ''; }} class="px-3 py-2 rounded-lg border border-dark-border text-gray-400 text-sm">ยกเลิก</button>
		</div>
	{:else}
		<button onclick={() => showAddRule = true} class="text-xs text-brand-primary hover:underline">+ เพิ่มกฎ</button>
	{/if}
</div>
