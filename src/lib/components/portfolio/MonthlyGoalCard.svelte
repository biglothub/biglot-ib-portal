<script lang="ts">
	import { formatCurrency, formatNumber } from '$lib/utils';
	import { invalidate } from '$app/navigation';

	let { data }: {
		data: {
			target: number;
			actual: number;
			progressPct: number;
			daysRemaining: number;
			daysElapsed: number;
			daysInMonth: number;
			tradeCount: number;
			hasTarget: boolean;
			goalId: string | null;
		} | null;
	} = $props();

	let editing = $state(false);
	let inputValue = $state('');
	let saving = $state(false);
	let errorMsg = $state<string | null>(null);

	const progressPct = $derived(data ? Math.max(0, Math.min(100, data.progressPct)) : 0);
	const onTrack = $derived(() => {
		if (!data || !data.hasTarget || data.daysInMonth === 0) return null;
		const expected = (data.daysElapsed / data.daysInMonth) * 100;
		return progressPct >= expected;
	});

	const barColor = $derived(
		!data || !data.hasTarget ? 'bg-gray-600' :
		data.actual < 0 ? 'bg-red-500' :
		progressPct >= 100 ? 'bg-green-500' :
		onTrack() ? 'bg-brand-primary' :
		'bg-amber-500'
	);

	function startEdit() {
		inputValue = data?.target ? String(data.target) : '';
		errorMsg = null;
		editing = true;
	}

	async function saveTarget() {
		const value = Number(inputValue);
		if (!Number.isFinite(value) || value < 0) {
			errorMsg = 'กรุณาใส่ตัวเลขที่ถูกต้อง';
			return;
		}
		saving = true;
		errorMsg = null;
		try {
			const res = await fetch('/api/portfolio/progress', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					goal_type: 'monthly_pnl',
					target_value: value,
					period_days: 30,
					is_active: true
				})
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				errorMsg = body.message || 'บันทึกไม่สำเร็จ';
				return;
			}
			editing = false;
			await invalidate('portfolio:baseData');
		} catch {
			errorMsg = 'ไม่สามารถเชื่อมต่อได้';
		} finally {
			saving = false;
		}
	}
</script>

<div class="card">
	<div class="flex items-center justify-between mb-2">
		<p class="text-[10px] uppercase tracking-[0.2em] text-gray-400">เป้าหมายเดือนนี้</p>
		{#if data?.hasTarget && !editing}
			<button onclick={startEdit} class="text-[11px] text-brand-primary hover:underline">แก้ไข</button>
		{/if}
	</div>

	{#if editing}
		<div class="space-y-2">
			<label class="block text-xs text-gray-400">
				เป้ากำไรรายเดือน ($)
				<input
					type="number"
					bind:value={inputValue}
					min="0"
					step="100"
					class="mt-1 w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
					placeholder="เช่น 5000"
				/>
			</label>
			{#if errorMsg}
				<p class="text-xs text-red-400">{errorMsg}</p>
			{/if}
			<div class="flex gap-2">
				<button
					onclick={saveTarget}
					disabled={saving}
					class="flex-1 rounded-lg bg-brand-primary text-dark-bg text-xs font-semibold py-2 hover:bg-brand-primary/90 disabled:opacity-50"
				>
					{saving ? 'กำลังบันทึก...' : 'บันทึก'}
				</button>
				<button
					onclick={() => { editing = false; errorMsg = null; }}
					disabled={saving}
					class="rounded-lg border border-dark-border text-xs text-gray-300 px-3 hover:bg-dark-hover"
				>
					ยกเลิก
				</button>
			</div>
		</div>
	{:else if !data || !data.hasTarget}
		<div class="text-center py-3">
			<p class="text-xs text-gray-500 mb-2">ยังไม่ได้ตั้งเป้ากำไรรายเดือน</p>
			<button
				onclick={startEdit}
				class="text-xs font-medium text-brand-primary hover:underline"
			>
				+ ตั้งเป้าหมาย
			</button>
		</div>
	{:else}
		<div class="space-y-2.5">
			<div class="flex items-end justify-between">
				<div>
					<div class="text-lg font-semibold {data.actual >= 0 ? 'text-white' : 'text-red-400'}">
						{formatCurrency(data.actual)}
					</div>
					<div class="text-[11px] text-gray-500">
						จาก {formatCurrency(data.target)} · {data.tradeCount} เทรด
					</div>
				</div>
				<div class="text-right">
					<div class="text-sm font-semibold {progressPct >= 100 ? 'text-green-400' : 'text-white'}">
						{formatNumber(progressPct, 0)}%
					</div>
					<div class="text-[11px] text-gray-500">เหลือ {data.daysRemaining} วัน</div>
				</div>
			</div>

			<div class="h-2 rounded-full bg-dark-bg overflow-hidden">
				<div
					class="h-full transition-all {barColor}"
					style="width: {progressPct}%"
				></div>
			</div>

			{#if onTrack() !== null}
				<div class="text-[11px] {onTrack() ? 'text-green-400' : 'text-amber-400'}">
					{onTrack() ? '✓ เดินตามเป้าอยู่' : '⚠ ต่ำกว่าเป้าที่ควรจะเป็น'}
				</div>
			{/if}
		</div>
	{/if}
</div>
