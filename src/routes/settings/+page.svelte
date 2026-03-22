<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { theme, type ThemeMode } from '$lib/stores/theme.svelte';

	const themeOptions: { value: ThemeMode; label: string; desc: string }[] = [
		{ value: 'dark', label: 'มืด', desc: 'พื้นหลังสีเข้ม' },
		{ value: 'light', label: 'สว่าง', desc: 'พื้นหลังสีอ่อน' },
		{ value: 'system', label: 'ระบบ', desc: 'ตามการตั้งค่าอุปกรณ์' }
	];

	let { data } = $props();
	let { profile } = $derived(data);
	let clientAccount = $derived(data.clientAccount);
	let notificationPrefs = $derived(data.notificationPrefs);

	// Editable display name
	let editingName = $state(false);
	let nameValue = $state(data.profile?.full_name || '');
	let savingName = $state(false);
	let nameMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// Notification prefs state
	let pushEnabled = $state(data.notificationPrefs?.push_enabled ?? false);
	let dailyEmailEnabled = $state(data.notificationPrefs?.daily_email_enabled ?? false);
	let tradeAlertsEnabled = $state(data.notificationPrefs?.trade_alerts_enabled ?? false);
	let weeklyRecapEnabled = $state(data.notificationPrefs?.weekly_recap_enabled ?? false);
	let savingNotifs = $state(false);
	let notifsMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	let notifsChanged = $derived(
		pushEnabled !== (notificationPrefs?.push_enabled ?? false) ||
		dailyEmailEnabled !== (notificationPrefs?.daily_email_enabled ?? false) ||
		tradeAlertsEnabled !== (notificationPrefs?.trade_alerts_enabled ?? false) ||
		weeklyRecapEnabled !== (notificationPrefs?.weekly_recap_enabled ?? false)
	);

	async function saveName() {
		const trimmed = nameValue.trim();
		if (!trimmed || trimmed.length < 2) {
			nameMessage = { type: 'error', text: 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร' };
			return;
		}
		if (trimmed === profile?.full_name) {
			editingName = false;
			return;
		}

		savingName = true;
		nameMessage = null;
		try {
			const res = await fetch('/api/settings/profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'update_name', full_name: trimmed })
			});
			const result = await res.json();
			if (res.ok) {
				nameMessage = { type: 'success', text: result.message };
				editingName = false;
				await invalidateAll();
			} else {
				nameMessage = { type: 'error', text: result.message };
			}
		} catch {
			nameMessage = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			savingName = false;
		}
	}

	async function saveNotifications() {
		savingNotifs = true;
		notifsMessage = null;
		try {
			const res = await fetch('/api/settings/profile', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_notifications',
					push_enabled: pushEnabled,
					daily_email_enabled: dailyEmailEnabled,
					trade_alerts_enabled: tradeAlertsEnabled,
					weekly_recap_enabled: weeklyRecapEnabled
				})
			});
			const result = await res.json();
			if (res.ok) {
				notifsMessage = { type: 'success', text: result.message };
				await invalidateAll();
			} else {
				notifsMessage = { type: 'error', text: result.message };
			}
		} catch {
			notifsMessage = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			savingNotifs = false;
		}
	}

	function getBrokerName(account: typeof clientAccount): string {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ibs = (account as any)?.master_ibs;
		if (!ibs) return '-';
		if (Array.isArray(ibs)) return ibs[0]?.company_name || '-';
		return ibs.company_name || '-';
	}

	function formatSyncDate(dateStr: string | null): string {
		if (!dateStr) return 'ยังไม่เคยซิงค์';
		const d = new Date(dateStr);
		return d.toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<!-- Profile Tab -->
<div class="space-y-6">
	<!-- Profile Info -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<h2 class="text-lg font-semibold mb-6">ข้อมูลโปรไฟล์</h2>

		<!-- Avatar + Name -->
		<div class="flex items-center gap-5 mb-8">
			{#if profile?.avatar_url}
				<img
					src={profile.avatar_url}
					alt={profile.full_name}
					class="w-20 h-20 rounded-full object-cover ring-2 ring-dark-border"
					referrerpolicy="no-referrer"
				/>
			{:else}
				<div class="w-20 h-20 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary text-2xl font-bold ring-2 ring-dark-border">
					{profile?.full_name?.charAt(0) || '?'}
				</div>
			{/if}
			<div>
				<p class="text-lg font-semibold text-white">{profile?.full_name || '-'}</p>
				<p class="text-sm text-gray-500">{profile?.email || '-'}</p>
				<span class="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-brand-primary/10 text-brand-primary font-medium">
					{profile?.role === 'admin' ? 'Admin' : profile?.role === 'master_ib' ? 'Master IB' : 'Client'}
				</span>
			</div>
		</div>

		<!-- Profile fields -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
			<div>
				<label class="label" for="settings-name">ชื่อที่แสดง</label>
				{#if editingName}
					<div class="flex gap-2">
						<input
							id="settings-name"
							type="text"
							bind:value={nameValue}
							class="input flex-1"
							maxlength={100}
							disabled={savingName}
							onkeydown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { editingName = false; nameValue = profile?.full_name || ''; } }}
						/>
						<button
							onclick={saveName}
							disabled={savingName}
							class="px-3 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
						>
							{#if savingName}
								<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							{:else}
								บันทึก
							{/if}
						</button>
						<button
							onclick={() => { editingName = false; nameValue = profile?.full_name || ''; nameMessage = null; }}
							disabled={savingName}
							class="px-3 py-2 rounded-lg border border-dark-border text-gray-400 text-sm hover:text-white hover:bg-dark-hover disabled:opacity-50 transition-colors"
						>
							ยกเลิก
						</button>
					</div>
				{:else}
					<div class="flex gap-2">
						<input
							id="settings-name"
							type="text"
							value={profile?.full_name || ''}
							disabled
							class="input flex-1 opacity-60 cursor-not-allowed"
						/>
						<button
							onclick={() => { editingName = true; nameValue = profile?.full_name || ''; nameMessage = null; }}
							aria-label="แก้ไขชื่อ"
							class="px-3 py-2 rounded-lg border border-dark-border text-gray-400 text-sm hover:text-white hover:bg-dark-hover transition-colors"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
							</svg>
						</button>
					</div>
				{/if}
				{#if nameMessage}
					<p class="text-xs mt-1 {nameMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}">
						{nameMessage.text}
					</p>
				{/if}
			</div>
			<div>
				<label class="label" for="settings-email">อีเมล</label>
				<input
					id="settings-email"
					type="email"
					value={profile?.email || ''}
					disabled
					class="input opacity-60 cursor-not-allowed"
				/>
			</div>
			<div>
				<label class="label" for="settings-role">บทบาท</label>
				<input
					id="settings-role"
					type="text"
					value={profile?.role === 'admin' ? 'Admin' : profile?.role === 'master_ib' ? 'Master IB' : 'Client'}
					disabled
					class="input opacity-60 cursor-not-allowed"
				/>
			</div>
			<div>
				<label class="label" for="settings-id">User ID</label>
				<input
					id="settings-id"
					type="text"
					value={profile?.id || '-'}
					disabled
					class="input opacity-60 cursor-not-allowed font-mono text-xs"
				/>
			</div>
		</div>

		<p class="text-xs text-gray-600 mt-4">
			อีเมลและรูปโปรไฟล์จะซิงค์จากบัญชี Google ของคุณ หากต้องการเปลี่ยนแปลง กรุณาอัปเดตที่บัญชี Google
		</p>
	</div>

	<!-- Theme Settings -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-2 mb-4">
			<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
			</svg>
			<h2 class="text-lg font-semibold">ธีม</h2>
		</div>

		<div class="grid grid-cols-3 gap-3">
			{#each themeOptions as opt}
				<button
					onclick={() => theme.set(opt.value)}
					class="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
						{theme.mode === opt.value
							? 'border-brand-primary bg-brand-primary/5'
							: 'border-dark-border hover:border-gray-500'}"
				>
					<!-- Theme preview -->
					<div class="w-full aspect-[4/3] rounded-lg overflow-hidden border border-dark-border">
						{#if opt.value === 'dark'}
							<div class="w-full h-full bg-[#0a0a0a] p-2 flex flex-col gap-1">
								<div class="h-1.5 w-8 rounded bg-gray-700"></div>
								<div class="h-1.5 w-12 rounded bg-gray-800"></div>
								<div class="flex-1 rounded bg-[#141414] mt-1"></div>
							</div>
						{:else if opt.value === 'light'}
							<div class="w-full h-full bg-[#f8fafc] p-2 flex flex-col gap-1">
								<div class="h-1.5 w-8 rounded bg-gray-300"></div>
								<div class="h-1.5 w-12 rounded bg-gray-200"></div>
								<div class="flex-1 rounded bg-white mt-1 border border-gray-200"></div>
							</div>
						{:else}
							<div class="w-full h-full flex">
								<div class="w-1/2 bg-[#0a0a0a] p-1.5 flex flex-col gap-0.5">
									<div class="h-1 w-5 rounded bg-gray-700"></div>
									<div class="flex-1 rounded bg-[#141414] mt-0.5"></div>
								</div>
								<div class="w-1/2 bg-[#f8fafc] p-1.5 flex flex-col gap-0.5">
									<div class="h-1 w-5 rounded bg-gray-300"></div>
									<div class="flex-1 rounded bg-white mt-0.5 border border-gray-200"></div>
								</div>
							</div>
						{/if}
					</div>

					<div class="text-center">
						<p class="text-sm font-medium {theme.mode === opt.value ? 'text-brand-primary' : 'text-white'}">{opt.label}</p>
						<p class="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
					</div>

					{#if theme.mode === opt.value}
						<svg class="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- MT5 Account Info -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-2 mb-4">
			<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
			</svg>
			<h2 class="text-lg font-semibold">ข้อมูลบัญชีเทรด</h2>
		</div>

		{#if clientAccount}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-500 mb-1">MT5 Account</p>
					<p class="text-sm text-white font-mono">{clientAccount.mt5_account_id}</p>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-500 mb-1">เซิร์ฟเวอร์</p>
					<p class="text-sm text-white">{clientAccount.mt5_server}</p>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-500 mb-1">โบรกเกอร์</p>
					<p class="text-sm text-white">
						{getBrokerName(clientAccount)}
					</p>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-500 mb-1">ชื่อบัญชี</p>
					<p class="text-sm text-white">{clientAccount.client_name}</p>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-500 mb-1">สถานะ</p>
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full {clientAccount.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}"></span>
						<p class="text-sm text-white">
							{clientAccount.status === 'approved' ? 'อนุมัติแล้ว' : clientAccount.status === 'pending' ? 'รอดำเนินการ' : clientAccount.status}
						</p>
					</div>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-500 mb-1">ซิงค์ล่าสุด</p>
					<p class="text-sm text-white">{formatSyncDate(clientAccount.last_synced_at)}</p>
				</div>
			</div>
			{#if clientAccount.sync_count > 0}
				<p class="text-xs text-gray-600 mt-3">ซิงค์ทั้งหมด {clientAccount.sync_count.toLocaleString()} ครั้ง</p>
			{/if}
		{:else}
			<!-- Empty state -->
			<div class="text-center py-8">
				<svg class="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<p class="text-sm text-gray-400 mb-1">ยังไม่มีบัญชีเทรดที่เชื่อมต่อ</p>
				<p class="text-xs text-gray-600">กรุณาติดต่อ IB ของคุณเพื่อเชื่อมต่อบัญชี MT5</p>
			</div>
		{/if}
	</div>

	<!-- Notification Preferences -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-2 mb-4">
			<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
			</svg>
			<h2 class="text-lg font-semibold">การแจ้งเตือน</h2>
		</div>

		<div class="space-y-4">
			<!-- Push Notifications -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-white">การแจ้งเตือนผ่าน Push</p>
					<p class="text-xs text-gray-500">รับแจ้งเตือนผ่านเบราว์เซอร์</p>
				</div>
				<button
					onclick={() => pushEnabled = !pushEnabled}
					class="w-11 h-6 rounded-full transition-colors relative {pushEnabled ? 'bg-brand-primary' : 'bg-dark-bg border border-dark-border'}"
					role="switch"
					aria-checked={pushEnabled}
					aria-label="การแจ้งเตือนผ่าน Push"
				>
					<div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {pushEnabled ? 'left-[22px]' : 'left-0.5'}"></div>
				</button>
			</div>

			<!-- Daily Email -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-white">อีเมลสรุปรายวัน</p>
					<p class="text-xs text-gray-500">รับสรุปผลเทรดทุกสิ้นวัน</p>
				</div>
				<button
					onclick={() => dailyEmailEnabled = !dailyEmailEnabled}
					class="w-11 h-6 rounded-full transition-colors relative {dailyEmailEnabled ? 'bg-brand-primary' : 'bg-dark-bg border border-dark-border'}"
					role="switch"
					aria-checked={dailyEmailEnabled}
					aria-label="อีเมลสรุปรายวัน"
				>
					<div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {dailyEmailEnabled ? 'left-[22px]' : 'left-0.5'}"></div>
				</button>
			</div>

			<!-- Trade Alerts -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-white">แจ้งเตือนเทรด</p>
					<p class="text-xs text-gray-500">รับแจ้งเตือนเมื่อมีเทรดใหม่หรือปิดเทรด</p>
				</div>
				<button
					onclick={() => tradeAlertsEnabled = !tradeAlertsEnabled}
					class="w-11 h-6 rounded-full transition-colors relative {tradeAlertsEnabled ? 'bg-brand-primary' : 'bg-dark-bg border border-dark-border'}"
					role="switch"
					aria-checked={tradeAlertsEnabled}
					aria-label="แจ้งเตือนเทรด"
				>
					<div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {tradeAlertsEnabled ? 'left-[22px]' : 'left-0.5'}"></div>
				</button>
			</div>

			<!-- Weekly Recap -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-white">สรุปรายสัปดาห์</p>
					<p class="text-xs text-gray-500">รับสรุปผลการเทรดรายสัปดาห์ทุกวันจันทร์</p>
				</div>
				<button
					onclick={() => weeklyRecapEnabled = !weeklyRecapEnabled}
					class="w-11 h-6 rounded-full transition-colors relative {weeklyRecapEnabled ? 'bg-brand-primary' : 'bg-dark-bg border border-dark-border'}"
					role="switch"
					aria-checked={weeklyRecapEnabled}
					aria-label="สรุปรายสัปดาห์"
				>
					<div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {weeklyRecapEnabled ? 'left-[22px]' : 'left-0.5'}"></div>
				</button>
			</div>
		</div>

		<!-- Save button -->
		{#if notifsChanged}
			<div class="mt-5 flex items-center gap-3">
				<button
					onclick={saveNotifications}
					disabled={savingNotifs}
					class="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
				>
					{#if savingNotifs}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
					{/if}
					บันทึกการแจ้งเตือน
				</button>
				<button
					onclick={() => {
						pushEnabled = notificationPrefs?.push_enabled ?? false;
						dailyEmailEnabled = notificationPrefs?.daily_email_enabled ?? false;
						tradeAlertsEnabled = notificationPrefs?.trade_alerts_enabled ?? false;
						weeklyRecapEnabled = notificationPrefs?.weekly_recap_enabled ?? false;
						notifsMessage = null;
					}}
					disabled={savingNotifs}
					class="px-4 py-2 rounded-lg border border-dark-border text-gray-400 text-sm hover:text-white hover:bg-dark-hover disabled:opacity-50 transition-colors"
				>
					ยกเลิก
				</button>
			</div>
		{/if}

		{#if notifsMessage}
			<p class="text-xs mt-3 {notifsMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}">
				{notifsMessage.text}
			</p>
		{/if}
	</div>
</div>
