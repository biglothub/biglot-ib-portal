<script lang="ts">
	import type { PerformanceAlert } from './+page.server';
	import type { AlertType } from '../../api/portfolio/alerts/+server';

	let { data } = $props();

	let alerts = $state<PerformanceAlert[]>(data.alerts);

	// New alert form
	let newType = $state<AlertType>('daily_loss');
	let newThreshold = $state('');
	let adding = $state(false);
	let evaluating = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	const alertTypeOptions: { value: AlertType; label: string; unit: string; hint: string }[] = [
		{
			value: 'daily_loss',
			label: 'ขาดทุนรายวันเกิน',
			unit: '$',
			hint: 'แจ้งเตือนเมื่อขาดทุนวันนี้เกินจำนวนที่กำหนด (USD)'
		},
		{
			value: 'daily_profit_target',
			label: 'ถึงเป้ากำไรรายวัน',
			unit: '$',
			hint: 'แจ้งเตือนเมื่อกำไรวันนี้ถึงเป้าหมาย (USD)'
		},
		{
			value: 'win_rate_drop',
			label: 'Win Rate ต่ำกว่า',
			unit: '%',
			hint: 'แจ้งเตือนเมื่อ Win Rate 30 วันล่าสุดต่ำกว่าเกณฑ์ที่กำหนด'
		},
		{
			value: 'drawdown',
			label: 'Max Drawdown เกิน',
			unit: '%',
			hint: 'แจ้งเตือนเมื่อ Drawdown เกินเปอร์เซ็นต์ที่กำหนด'
		},
		{
			value: 'loss_streak',
			label: 'แพ้ติดต่อกัน',
			unit: 'ไม้',
			hint: 'แจ้งเตือนเมื่อขาดทุนติดต่อกันถึงจำนวนที่กำหนด'
		}
	];

	function getLabelForType(type: AlertType) {
		return alertTypeOptions.find((o) => o.value === type)?.label ?? type;
	}

	function getUnitForType(type: AlertType) {
		return alertTypeOptions.find((o) => o.value === type)?.unit ?? '';
	}

	function formatLastTriggered(ts: string | null) {
		if (!ts) return 'ยังไม่เคยทำงาน';
		return new Date(ts).toLocaleString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function addAlert() {
		const threshold = parseFloat(newThreshold);
		if (!newThreshold || isNaN(threshold) || threshold <= 0) {
			message = { type: 'error', text: 'กรุณากรอกค่าเกณฑ์ที่ถูกต้อง' };
			return;
		}

		adding = true;
		message = null;

		try {
			const res = await fetch('/api/portfolio/alerts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ alert_type: newType, threshold, enabled: true })
			});

			const result = await res.json();

			if (res.ok) {
				alerts = [...alerts, result.alert];
				newThreshold = '';
				message = { type: 'success', text: 'เพิ่มการแจ้งเตือนแล้ว' };
			} else {
				message = { type: 'error', text: result.message || 'เกิดข้อผิดพลาด' };
			}
		} catch {
			message = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			adding = false;
		}
	}

	async function toggleAlert(alert: PerformanceAlert) {
		const optimistic = !alert.enabled;
		alerts = alerts.map((a) => (a.id === alert.id ? { ...a, enabled: optimistic } : a));

		try {
			const res = await fetch('/api/portfolio/alerts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: alert.id,
					alert_type: alert.alert_type,
					threshold: alert.threshold,
					enabled: optimistic
				})
			});

			if (!res.ok) {
				// Revert on failure
				alerts = alerts.map((a) => (a.id === alert.id ? { ...a, enabled: !optimistic } : a));
				message = { type: 'error', text: 'ไม่สามารถอัปเดตได้' };
			}
		} catch {
			alerts = alerts.map((a) => (a.id === alert.id ? { ...a, enabled: !optimistic } : a));
		}
	}

	async function deleteAlert(id: string) {
		alerts = alerts.filter((a) => a.id !== id);

		try {
			const res = await fetch(`/api/portfolio/alerts?id=${id}`, { method: 'DELETE' });
			if (!res.ok) {
				// Reload on failure
				const { data: fresh } = await (await fetch('/api/portfolio/alerts')).json();
				if (fresh) alerts = fresh;
			}
		} catch {
			// best effort
		}
	}

	async function evaluateNow() {
		evaluating = true;
		message = null;

		try {
			const res = await fetch('/api/portfolio/alerts/evaluate', { method: 'POST' });
			const result = await res.json();

			if (res.ok) {
				if (result.triggered > 0) {
					message = {
						type: 'success',
						text: `ตรวจสอบแล้ว — ส่งการแจ้งเตือน ${result.triggered} รายการ`
					};
				} else {
					message = { type: 'success', text: 'ตรวจสอบแล้ว — ไม่มีเกณฑ์ที่ถูกกระตุ้น' };
				}
				// Refresh last_triggered_at
				const fresh = await fetch('/api/portfolio/alerts');
				const freshData = await fresh.json();
				if (freshData.alerts) alerts = freshData.alerts;
			} else {
				message = { type: 'error', text: result.message || 'เกิดข้อผิดพลาด' };
			}
		} catch {
			message = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			evaluating = false;
		}
	}

	const selectedOption = $derived(alertTypeOptions.find((o) => o.value === newType));
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-start justify-between gap-4">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
					<svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
					</svg>
				</div>
				<div>
					<h2 class="text-lg font-semibold">การแจ้งเตือนประสิทธิภาพ</h2>
					<p class="text-xs text-gray-400 mt-0.5">
						รับการแจ้งเตือน Push Notification เมื่อตัวชี้วัดถึงเกณฑ์ที่กำหนด
					</p>
				</div>
			</div>

			<button
				onclick={evaluateNow}
				disabled={evaluating}
				class="shrink-0 flex items-center gap-2 rounded-lg border border-dark-border bg-dark-hover px-4 py-2 text-sm text-white hover:bg-dark-border transition-colors disabled:opacity-50"
			>
				{#if evaluating}
					<svg class="w-4 h-4 animate-spin text-brand-primary" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
					</svg>
					<span>กำลังตรวจสอบ...</span>
				{:else}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span>ตรวจสอบตอนนี้</span>
				{/if}
			</button>
		</div>

		<!-- Status message -->
		{#if message}
			<div
				class="mt-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2
					{message.type === 'success'
						? 'bg-green-500/10 text-green-400 border border-green-500/20'
						: 'bg-red-500/10 text-red-400 border border-red-500/20'}"
			>
				<svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
					{#if message.type === 'success'}
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
					{:else}
						<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
					{/if}
				</svg>
				{message.text}
			</div>
		{/if}
	</div>

	<!-- Add Alert Form -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<h3 class="text-sm font-semibold text-white mb-4">เพิ่มการแจ้งเตือนใหม่</h3>

		<div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
			<!-- Type selector -->
			<div class="space-y-1">
				<label for="alert-type" class="text-xs text-gray-400">ประเภทการแจ้งเตือน</label>
				<select
					id="alert-type"
					bind:value={newType}
					class="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
				>
					{#each alertTypeOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				{#if selectedOption}
					<p class="text-xs text-gray-400">{selectedOption.hint}</p>
				{/if}
			</div>

			<!-- Threshold input -->
			<div class="space-y-1 sm:w-40">
				<label for="alert-threshold" class="text-xs text-gray-400">
					เกณฑ์ ({selectedOption?.unit ?? ''})
				</label>
				<div class="relative">
					{#if selectedOption?.unit === '$'}
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
					{/if}
					<input
						id="alert-threshold"
						type="number"
						bind:value={newThreshold}
						min="0.01"
						step="any"
						placeholder="0"
						class="w-full rounded-lg border border-dark-border bg-dark-bg py-2 text-sm text-white focus:border-brand-primary focus:outline-none
							{selectedOption?.unit === '$' ? 'pl-7 pr-3' : 'px-3'}"
						onkeydown={(e) => { if (e.key === 'Enter') addAlert(); }}
					/>
					{#if selectedOption?.unit !== '$'}
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
							{selectedOption?.unit}
						</span>
					{/if}
				</div>
			</div>

			<!-- Add button -->
			<div>
				<button
					onclick={addAlert}
					disabled={adding || !newThreshold}
					class="flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
				>
					{#if adding}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
						</svg>
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
					{/if}
					เพิ่ม
				</button>
			</div>
		</div>
	</div>

	<!-- Alert list -->
	<div class="rounded-xl border border-dark-border bg-dark-surface overflow-hidden">
		<div class="px-6 py-4 border-b border-dark-border flex items-center justify-between">
			<h3 class="text-sm font-semibold text-white">กฎการแจ้งเตือนทั้งหมด</h3>
			<span class="text-xs text-gray-400">{alerts.length} รายการ</span>
		</div>

		{#if alerts.length === 0}
			<!-- Empty state -->
			<div class="flex flex-col items-center justify-center py-16 px-6 text-center">
				<div class="w-14 h-14 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
					<svg class="w-7 h-7 text-yellow-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
							d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
					</svg>
				</div>
				<p class="text-sm font-medium text-gray-300">ยังไม่มีการแจ้งเตือน</p>
				<p class="text-xs text-gray-400 mt-1">เพิ่มกฎการแจ้งเตือนด้านบนเพื่อเริ่มต้น</p>
			</div>
		{:else}
			<ul class="divide-y divide-dark-border">
				{#each alerts as alert (alert.id)}
					<li class="flex items-center gap-4 px-6 py-4 hover:bg-dark-hover/30 transition-colors group">
						<!-- Type icon -->
						<div class="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center
							{alert.alert_type === 'daily_loss' ? 'bg-red-500/10' :
							 alert.alert_type === 'daily_profit_target' ? 'bg-green-500/10' :
							 alert.alert_type === 'win_rate_drop' ? 'bg-orange-500/10' :
							 alert.alert_type === 'drawdown' ? 'bg-red-500/10' :
							 'bg-yellow-500/10'}">
							{#if alert.alert_type === 'daily_loss' || alert.alert_type === 'drawdown'}
								<svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
								</svg>
							{:else if alert.alert_type === 'daily_profit_target'}
								<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
								</svg>
							{:else if alert.alert_type === 'win_rate_drop'}
								<svg class="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
							{:else}
								<svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
								</svg>
							{/if}
						</div>

						<!-- Info -->
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<span class="text-sm font-medium text-white">
									{getLabelForType(alert.alert_type)}
								</span>
								<span class="text-sm font-semibold
									{alert.alert_type === 'daily_loss' || alert.alert_type === 'drawdown' ? 'text-red-400' :
									 alert.alert_type === 'daily_profit_target' ? 'text-green-400' :
									 'text-yellow-400'}">
									{alert.alert_type === 'daily_loss' || alert.alert_type === 'daily_profit_target'
										? `$${alert.threshold.toLocaleString()}`
										: alert.alert_type === 'loss_streak'
										? `${alert.threshold} ไม้`
										: `${alert.threshold}%`}
								</span>
							</div>
							<p class="text-xs text-gray-400 mt-0.5">
								{formatLastTriggered(alert.last_triggered_at)}
							</p>
						</div>

						<!-- Toggle -->
						<button
							onclick={() => toggleAlert(alert)}
							class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
								{alert.enabled ? 'bg-brand-primary' : 'bg-dark-border'}"
							aria-label="{alert.enabled ? 'ปิด' : 'เปิด'}การแจ้งเตือน"
						>
							<span
								class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
									{alert.enabled ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}"
							></span>
						</button>

						<!-- Delete -->
						<button
							onclick={() => deleteAlert(alert.id)}
							class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
							aria-label="ลบการแจ้งเตือน"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Info box -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-5">
		<div class="flex gap-3">
			<svg class="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<div class="space-y-1">
				<p class="text-sm font-medium text-white">วิธีรับการแจ้งเตือน</p>
				<ul class="text-xs text-gray-400 space-y-1 list-disc list-inside">
					<li>ต้องเปิดใช้ Push Notification ในเบราว์เซอร์</li>
					<li>การแจ้งเตือนแต่ละกฎจะทำงานได้สูงสุด 1 ครั้ง/ชั่วโมง</li>
					<li>กดปุ่ม "ตรวจสอบตอนนี้" เพื่อประเมินเกณฑ์ทันที</li>
					<li>ระบบจะตรวจสอบอัตโนมัติเมื่อมีการ Sync ข้อมูล</li>
				</ul>
			</div>
		</div>
	</div>
</div>
