<script lang="ts">
	import type { EmailReportSettings } from './+page.server';

	let { data } = $props();

	let settings = $state<EmailReportSettings>({ ...data.settings });
	let saving = $state(false);
	let testingDaily = $state(false);
	let testingWeekly = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	const HOURS = Array.from({ length: 24 }, (_, i) => ({
		value: i,
		label: `${String(i).padStart(2, '0')}:00 UTC`
	}));

	const DAYS_OF_WEEK = [
		{ value: 0, label: 'อาทิตย์' },
		{ value: 1, label: 'จันทร์' },
		{ value: 2, label: 'อังคาร' },
		{ value: 3, label: 'พุธ' },
		{ value: 4, label: 'พฤหัสบดี' },
		{ value: 5, label: 'ศุกร์' },
		{ value: 6, label: 'เสาร์' }
	];

	function formatLastSent(ts: string | null): string {
		if (!ts) return 'ยังไม่เคยส่ง';
		const d = new Date(ts);
		return d.toLocaleString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function showMessage(type: 'success' | 'error', text: string) {
		message = { type, text };
		setTimeout(() => {
			message = null;
		}, 4000);
	}

	async function save() {
		saving = true;
		try {
			const res = await fetch('/api/portfolio/daily-report', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					daily_enabled: settings.daily_enabled,
					daily_send_hour: settings.daily_send_hour,
					weekly_enabled: settings.weekly_enabled,
					weekly_day: settings.weekly_day
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.message || 'เกิดข้อผิดพลาด');
			settings = { ...settings, ...json.settings };
			showMessage('success', 'บันทึกการตั้งค่าสำเร็จ');
		} catch (err: unknown) {
			showMessage('error', err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
		} finally {
			saving = false;
		}
	}

	async function sendTest(type: 'daily' | 'weekly') {
		if (type === 'daily') testingDaily = true;
		else testingWeekly = true;
		try {
			const res = await fetch('/api/portfolio/daily-report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, test: true })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.message || 'เกิดข้อผิดพลาด');
			showMessage('success', json.message || 'ส่งทดสอบสำเร็จ — ตรวจสอบอีเมลของคุณ');
		} catch (err: unknown) {
			showMessage('error', err instanceof Error ? err.message : 'ส่งไม่สำเร็จ');
		} finally {
			if (type === 'daily') testingDaily = false;
			else testingWeekly = false;
		}
	}
</script>

<svelte:head>
	<title>รายงานทางอีเมล - ตั้งค่า</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h2 class="text-lg font-semibold text-white">รายงานทางอีเมล</h2>
		<p class="mt-1 text-sm text-gray-400">รับสรุปผลการเทรดของคุณส่งตรงถึงอีเมลโดยอัตโนมัติ</p>
	</div>

	<!-- Status message -->
	{#if message}
		<div
			class="flex items-center gap-2 rounded-lg px-4 py-3 text-sm
			{message.type === 'success'
				? 'bg-green-500/10 border border-green-500/30 text-green-400'
				: 'bg-red-500/10 border border-red-500/30 text-red-400'}"
		>
			<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				{#if message.type === 'success'}
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				{:else}
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				{/if}
			</svg>
			{message.text}
		</div>
	{/if}

	<!-- Daily Report Card -->
	<div class="rounded-xl border border-dark-border bg-dark-surface">
		<div class="flex items-start justify-between p-6 border-b border-dark-border">
			<div class="flex items-start gap-4">
				<div class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
					<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-white">รายงานรายวัน</h3>
					<p class="mt-1 text-sm text-gray-400">
						สรุปผลการเทรดสิ้นวัน: กำไร/ขาดทุน, จำนวนเทรด, Win Rate, วินัย และเทรดที่ดีที่สุด/แย่ที่สุด
					</p>
					{#if settings.last_daily_sent_at}
						<p class="mt-1 text-xs text-gray-400">ส่งล่าสุด: {formatLastSent(settings.last_daily_sent_at)}</p>
					{/if}
				</div>
			</div>
			<!-- Toggle -->
			<button
				onclick={() => (settings.daily_enabled = !settings.daily_enabled)}
				class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
					{settings.daily_enabled ? 'bg-brand-primary' : 'bg-gray-600'}"
				role="switch"
				aria-checked={settings.daily_enabled}
				aria-label="เปิด/ปิดรายงานรายวัน"
			>
				<span
					class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform
						{settings.daily_enabled ? 'translate-x-5' : 'translate-x-0'}"
				></span>
			</button>
		</div>

		{#if settings.daily_enabled}
			<div class="p-6 space-y-4">
				<div class="flex items-center gap-4">
					<label class="text-sm font-medium text-gray-300 whitespace-nowrap" for="daily-hour">
						เวลาที่ส่ง (UTC)
					</label>
					<select
						id="daily-hour"
						bind:value={settings.daily_send_hour}
						class="rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
					>
						{#each HOURS as h}
							<option value={h.value}>{h.label}</option>
						{/each}
					</select>
					<span class="text-xs text-gray-400">เวลาไทย UTC+7: {String((settings.daily_send_hour + 7) % 24).padStart(2, '0')}:00</span>
				</div>

				<div class="flex items-center justify-between pt-2 border-t border-dark-border">
					<span class="text-sm text-gray-400">ส่งอีเมลทดสอบเดี๋ยวนี้</span>
					<button
						onclick={() => sendTest('daily')}
						disabled={testingDaily}
						class="flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2 text-sm text-gray-300
							hover:border-brand-primary hover:text-white transition-colors disabled:opacity-50"
					>
						{#if testingDaily}
							<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							กำลังส่ง...
						{:else}
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
									d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
							</svg>
							ส่งทดสอบ
						{/if}
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Weekly Digest Card -->
	<div class="rounded-xl border border-dark-border bg-dark-surface">
		<div class="flex items-start justify-between p-6 border-b border-dark-border">
			<div class="flex items-start gap-4">
				<div class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
					<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
				</div>
				<div>
					<h3 class="font-semibold text-white">สรุปรายสัปดาห์</h3>
					<p class="mt-1 text-sm text-gray-400">
						สรุปผลการเทรดรายสัปดาห์: Net P&L, Win Rate, Profit Factor, Day Win%, สัญลักษณ์ที่ดีที่สุด และ Journal Streak
					</p>
					{#if settings.last_weekly_sent_at}
						<p class="mt-1 text-xs text-gray-400">ส่งล่าสุด: {formatLastSent(settings.last_weekly_sent_at)}</p>
					{/if}
				</div>
			</div>
			<!-- Toggle -->
			<button
				onclick={() => (settings.weekly_enabled = !settings.weekly_enabled)}
				class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
					{settings.weekly_enabled ? 'bg-brand-primary' : 'bg-gray-600'}"
				role="switch"
				aria-checked={settings.weekly_enabled}
				aria-label="เปิด/ปิดสรุปรายสัปดาห์"
			>
				<span
					class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform
						{settings.weekly_enabled ? 'translate-x-5' : 'translate-x-0'}"
				></span>
			</button>
		</div>

		{#if settings.weekly_enabled}
			<div class="p-6 space-y-4">
				<div class="flex items-center gap-4">
					<label class="text-sm font-medium text-gray-300 whitespace-nowrap" for="weekly-day">
						ส่งทุกวัน
					</label>
					<select
						id="weekly-day"
						bind:value={settings.weekly_day}
						class="rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
					>
						{#each DAYS_OF_WEEK as d}
							<option value={d.value}>{d.label}</option>
						{/each}
					</select>
					<span class="text-xs text-gray-400">เวลาส่งจะตรงกับ {String((settings.daily_send_hour + 7) % 24).padStart(2, '0')}:00 ตามเขตเวลาไทย</span>
				</div>

				<div class="flex items-center justify-between pt-2 border-t border-dark-border">
					<span class="text-sm text-gray-400">ส่งอีเมลทดสอบเดี๋ยวนี้</span>
					<button
						onclick={() => sendTest('weekly')}
						disabled={testingWeekly}
						class="flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2 text-sm text-gray-300
							hover:border-brand-primary hover:text-white transition-colors disabled:opacity-50"
					>
						{#if testingWeekly}
							<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							กำลังส่ง...
						{:else}
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
									d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
							</svg>
							ส่งทดสอบ
						{/if}
					</button>
				</div>
			</div>
		{/if}
	</div>

	<!-- Info box about email provider -->
	<div class="rounded-lg border border-dark-border bg-dark-bg p-4">
		<div class="flex gap-3">
			<svg class="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<div class="text-sm text-gray-400 space-y-1">
				<p>อีเมลจะถูกส่งไปยัง <span class="text-white font-medium">อีเมลที่ใช้ลงทะเบียน</span> ของคุณ</p>
				<p>การส่งจะเกิดขึ้นโดยอัตโนมัติตามเวลาที่กำหนด ผ่าน Resend API</p>
				<p class="text-xs text-gray-400">ต้องการตั้งค่า <code class="bg-dark-surface px-1 py-0.5 rounded text-gray-300">RESEND_API_KEY</code> ในเซิร์ฟเวอร์เพื่อส่งอีเมล</p>
			</div>
		</div>
	</div>

	<!-- Save Button -->
	<div class="flex justify-end">
		<button
			onclick={save}
			disabled={saving}
			class="flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white
				hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
		>
			{#if saving}
				<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
				กำลังบันทึก...
			{:else}
				บันทึกการตั้งค่า
			{/if}
		</button>
	</div>
</div>
