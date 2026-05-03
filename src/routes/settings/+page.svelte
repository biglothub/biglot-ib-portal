<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { openPushPermissionPrompt } from '$lib/pwa/push';
	import { theme, type ThemeMode } from '$lib/stores/theme.svelte';

	const themeOptions: { value: ThemeMode; label: string; desc: string }[] = [
		{ value: 'gold', label: 'Gold', desc: 'ธีมหลักของ IB Portal' },
		{ value: 'dark', label: 'มืด', desc: 'black/white dark' },
		{ value: 'light', label: 'สว่าง', desc: 'black/white light' },
		{ value: 'system', label: 'ระบบ', desc: 'ตามอุปกรณ์' }
	];

	let { data } = $props();
	let { profile } = $derived(data);
	let clientAccount = $derived(data.clientAccount);
	let notificationPrefs = $derived(data.notificationPrefs);

	// Editable display name
	let editingName = $state(false);
	let nameValue = $state('');
	let savingName = $state(false);
	let nameMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	// API Keys
	interface ApiKey {
		id: string;
		name: string;
		key_prefix: string;
		scopes: string[];
		last_used_at: string | null;
		expires_at: string | null;
		is_active: boolean;
		created_at: string;
	}
	let apiKeys = $derived((data.apiKeys ?? []) as ApiKey[]);
	let creatingKey = $state(false);
	let newKeyName = $state('');
	let newKeyRevealed = $state<string | null>(null);
	let apiKeyMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let revokingId = $state<string | null>(null);
	let confirmRevokeId = $state<string | null>(null);

	async function createApiKey() {
		const trimmed = newKeyName.trim();
		if (!trimmed) {
			apiKeyMessage = { type: 'error', text: 'กรุณาตั้งชื่อ API Key' };
			return;
		}
		creatingKey = true;
		apiKeyMessage = null;
		try {
			const res = await fetch('/api/portfolio/api-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmed })
			});
			const result = await res.json();
			if (res.ok) {
				newKeyRevealed = result.key;
				newKeyName = '';
				await invalidateAll();
			} else {
				apiKeyMessage = { type: 'error', text: result.error || 'เกิดข้อผิดพลาด' };
			}
		} catch {
			apiKeyMessage = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			creatingKey = false;
		}
	}

	async function revokeApiKey(id: string) {
		revokingId = id;
		try {
			const res = await fetch('/api/portfolio/api-keys', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (res.ok) {
				confirmRevokeId = null;
				await invalidateAll();
			} else {
				const result = await res.json();
				apiKeyMessage = { type: 'error', text: result.error || 'เกิดข้อผิดพลาด' };
			}
		} catch {
			apiKeyMessage = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			revokingId = null;
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		apiKeyMessage = { type: 'success', text: 'คัดลอกแล้ว' };
		setTimeout(() => { if (apiKeyMessage?.text === 'คัดลอกแล้ว') apiKeyMessage = null; }, 2000);
	}

	function formatKeyDate(dateStr: string | null): string {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleDateString('th-TH', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}

	// Data export
	let exporting = $state(false);
	let exportMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	async function downloadExport() {
		exporting = true;
		exportMessage = null;
		try {
			const res = await fetch('/api/portfolio/export');
			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }));
				exportMessage = { type: 'error', text: err.message };
				return;
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			const date = new Date().toISOString().slice(0, 10);
			a.href = url;
			a.download = `ib-portal-export-${date}.zip`;
			a.click();
			URL.revokeObjectURL(url);
			exportMessage = { type: 'success', text: 'ดาวน์โหลดสำเร็จ' };
		} catch {
			exportMessage = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			exporting = false;
		}
	}

	// Sync nameValue when data changes (e.g. after invalidation)
	$effect(() => {
		nameValue = profile?.full_name || '';
	});

	// Notification prefs state
	let pushEnabled = $state(false);
	let dailyEmailEnabled = $state(false);
	let tradeAlertsEnabled = $state(false);
	let weeklyRecapEnabled = $state(false);
	let syncStatusEnabled = $state(true);
	let riskThresholdEnabled = $state(true);
	let accountStatusEnabled = $state(true);
	let journalReminderEnabled = $state(false);
	let aiInsightEnabled = $state(true);

	// Sync notification prefs when data changes
	$effect(() => {
		pushEnabled = notificationPrefs?.push_enabled ?? false;
		dailyEmailEnabled = notificationPrefs?.daily_email_enabled ?? false;
		tradeAlertsEnabled = notificationPrefs?.trade_alerts_enabled ?? false;
		weeklyRecapEnabled = notificationPrefs?.weekly_recap_enabled ?? false;
		syncStatusEnabled = notificationPrefs?.sync_status_enabled ?? true;
		riskThresholdEnabled = notificationPrefs?.risk_threshold_enabled ?? true;
		accountStatusEnabled = notificationPrefs?.account_status_enabled ?? true;
		journalReminderEnabled = notificationPrefs?.journal_reminder_enabled ?? false;
		aiInsightEnabled = notificationPrefs?.ai_insight_enabled ?? true;
	});
	let savingNotifs = $state(false);
	let notifsMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	let notifsChanged = $derived(
		pushEnabled !== (notificationPrefs?.push_enabled ?? false) ||
		dailyEmailEnabled !== (notificationPrefs?.daily_email_enabled ?? false) ||
		tradeAlertsEnabled !== (notificationPrefs?.trade_alerts_enabled ?? false) ||
		weeklyRecapEnabled !== (notificationPrefs?.weekly_recap_enabled ?? false) ||
		syncStatusEnabled !== (notificationPrefs?.sync_status_enabled ?? true) ||
		riskThresholdEnabled !== (notificationPrefs?.risk_threshold_enabled ?? true) ||
		accountStatusEnabled !== (notificationPrefs?.account_status_enabled ?? true) ||
		journalReminderEnabled !== (notificationPrefs?.journal_reminder_enabled ?? false) ||
		aiInsightEnabled !== (notificationPrefs?.ai_insight_enabled ?? true)
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
					weekly_recap_enabled: weeklyRecapEnabled,
					sync_status_enabled: syncStatusEnabled,
					risk_threshold_enabled: riskThresholdEnabled,
					account_status_enabled: accountStatusEnabled,
					journal_reminder_enabled: journalReminderEnabled,
					ai_insight_enabled: aiInsightEnabled
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

	// ─── Webhook state ───────────────────────────────────────────────────────

	type WebhookType = 'line' | 'discord';
	type WebhookEvent = 'trade_sync' | 'daily_pnl' | 'rule_break';

	interface WebhookConfig {
		id: string;
		webhook_type: WebhookType;
		webhook_url: string;
		events: WebhookEvent[];
		is_active: boolean;
	}

	const ALL_EVENTS: { value: WebhookEvent; label: string }[] = [
		{ value: 'trade_sync', label: 'ซิงค์การเทรด' },
		{ value: 'daily_pnl', label: 'สรุป P&L รายวัน' },
		{ value: 'rule_break', label: 'ละเมิดกฎ' }
	];

	// Keyed by webhook_type
	let webhookConfigs = $state<Record<WebhookType, WebhookConfig | null>>({ line: null, discord: null });
	let webhookLoading = $state(true);
	let webhookUrlInputs = $state<Record<WebhookType, string>>({ line: '', discord: '' });
	let webhookEventsInputs = $state<Record<WebhookType, WebhookEvent[]>>({
		line: ['trade_sync', 'daily_pnl', 'rule_break'],
		discord: ['trade_sync', 'daily_pnl', 'rule_break']
	});
	let webhookActiveInputs = $state<Record<WebhookType, boolean>>({ line: true, discord: true });
	let webhookSaving = $state<Record<WebhookType, boolean>>({ line: false, discord: false });
	let webhookTesting = $state<Record<WebhookType, boolean>>({ line: false, discord: false });
	let webhookMessages = $state<Record<WebhookType, { type: 'success' | 'error'; text: string } | null>>({
		line: null,
		discord: null
	});

	async function loadWebhooks() {
		webhookLoading = true;
		try {
			const res = await fetch('/api/portfolio/webhooks');
			if (!res.ok) return;
			const { configs } = await res.json() as { configs: WebhookConfig[] };
			for (const cfg of configs) {
				webhookConfigs[cfg.webhook_type] = cfg;
				webhookUrlInputs[cfg.webhook_type] = cfg.webhook_url;
				webhookEventsInputs[cfg.webhook_type] = [...cfg.events];
				webhookActiveInputs[cfg.webhook_type] = cfg.is_active;
			}
		} finally {
			webhookLoading = false;
		}
	}

	async function saveWebhook(type: WebhookType) {
		webhookSaving[type] = true;
		webhookMessages[type] = null;
		try {
			const res = await fetch('/api/portfolio/webhooks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					webhook_type: type,
					webhook_url: webhookUrlInputs[type],
					events: webhookEventsInputs[type],
					is_active: webhookActiveInputs[type]
				})
			});
			const result = await res.json() as { config?: WebhookConfig; message?: string };
			if (res.ok && result.config) {
				webhookConfigs[type] = result.config;
				webhookMessages[type] = { type: 'success', text: 'บันทึกเรียบร้อยแล้ว' };
			} else {
				webhookMessages[type] = { type: 'error', text: result.message ?? 'เกิดข้อผิดพลาด' };
			}
		} catch {
			webhookMessages[type] = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			webhookSaving[type] = false;
		}
	}

	async function deleteWebhook(type: WebhookType) {
		webhookSaving[type] = true;
		webhookMessages[type] = null;
		try {
			const res = await fetch('/api/portfolio/webhooks', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ webhook_type: type })
			});
			if (res.ok) {
				webhookConfigs[type] = null;
				webhookUrlInputs[type] = '';
				webhookEventsInputs[type] = ['trade_sync', 'daily_pnl', 'rule_break'];
				webhookActiveInputs[type] = true;
				webhookMessages[type] = { type: 'success', text: 'ลบเรียบร้อยแล้ว' };
			} else {
				const result = await res.json() as { message?: string };
				webhookMessages[type] = { type: 'error', text: result.message ?? 'เกิดข้อผิดพลาด' };
			}
		} catch {
			webhookMessages[type] = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			webhookSaving[type] = false;
		}
	}

	async function testWebhook(type: WebhookType) {
		webhookTesting[type] = true;
		webhookMessages[type] = null;
		try {
			const res = await fetch('/api/portfolio/webhooks/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ webhook_type: type })
			});
			const result = await res.json() as { success?: boolean; message?: string };
			if (res.ok && result.success) {
				webhookMessages[type] = { type: 'success', text: 'ส่งข้อความทดสอบสำเร็จ' };
			} else {
				webhookMessages[type] = { type: 'error', text: result.message ?? 'ทดสอบไม่สำเร็จ' };
			}
		} catch {
			webhookMessages[type] = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			webhookTesting[type] = false;
		}
	}

	function toggleWebhookEvent(type: WebhookType, event: WebhookEvent) {
		const current = webhookEventsInputs[type];
		if (current.includes(event)) {
			webhookEventsInputs[type] = current.filter((e) => e !== event);
		} else {
			webhookEventsInputs[type] = [...current, event];
		}
	}

	// Load webhook configs on mount
	$effect(() => {
		loadWebhooks();
	});
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
					width="80"
					height="80"
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
				<p class="text-sm text-gray-400">{profile?.email || '-'}</p>
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

		<p class="text-xs text-gray-400 mt-4">
			อีเมลและรูปโปรไฟล์จะซิงค์จากบัญชี Google ของคุณ หากต้องการเปลี่ยนแปลง กรุณาอัปเดตที่บัญชี Google
		</p>
	</div>

	<!-- Theme Settings -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-2 mb-4">
			<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
			</svg>
			<div>
				<h2 class="text-lg font-semibold">ธีม</h2>
				<p class="text-xs text-gray-400 mt-0.5">Gold เป็นค่าเริ่มต้น ส่วนมืด/สว่าง/ระบบยังใช้ได้เหมือนเดิม</p>
			</div>
		</div>

		<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
			{#each themeOptions as opt}
				<button
					onclick={() => theme.set(opt.value)}
					class="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all
						{theme.mode === opt.value
							? 'border-brand-primary bg-brand-primary/5'
							: 'border-dark-border hover:border-gray-500'}"
				>
					<div class="w-full aspect-[4/3] rounded-lg overflow-hidden border border-dark-border">
						{#if opt.value === 'gold'}
							<div class="w-full h-full bg-[#0a0a0a] p-2 flex flex-col gap-1">
								<div class="h-1.5 w-8 rounded bg-[#c9a84c]"></div>
								<div class="h-1.5 w-12 rounded bg-[#8a8578]"></div>
								<div class="flex-1 rounded bg-[#1a1815] mt-1 border border-[#f5f1e314]"></div>
							</div>
						{:else if opt.value === 'dark'}
							<div class="w-full h-full bg-[#0a0a0a] p-2 flex flex-col gap-1">
								<div class="h-1.5 w-8 rounded bg-gray-500"></div>
								<div class="h-1.5 w-12 rounded bg-gray-700"></div>
								<div class="flex-1 rounded bg-[#141414] mt-1 border border-white/10"></div>
							</div>
						{:else if opt.value === 'light'}
							<div class="w-full h-full bg-[#f8fafc] p-2 flex flex-col gap-1">
								<div class="h-1.5 w-8 rounded bg-slate-400"></div>
								<div class="h-1.5 w-12 rounded bg-slate-200"></div>
								<div class="flex-1 rounded bg-white mt-1 border border-slate-200"></div>
							</div>
						{:else}
							<div class="w-full h-full flex">
								<div class="w-1/2 bg-[#0a0a0a] p-1.5 flex flex-col gap-0.5">
									<div class="h-1 w-5 rounded bg-gray-500"></div>
									<div class="flex-1 rounded bg-[#141414] mt-0.5"></div>
								</div>
								<div class="w-1/2 bg-[#f8fafc] p-1.5 flex flex-col gap-0.5">
									<div class="h-1 w-5 rounded bg-slate-300"></div>
									<div class="flex-1 rounded bg-white mt-0.5 border border-slate-200"></div>
								</div>
							</div>
						{/if}
					</div>

					<div class="text-center">
						<p class="text-sm font-medium {theme.mode === opt.value ? 'text-brand-primary' : 'text-white'}">{opt.label}</p>
						<p class="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
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
					<p class="text-xs text-gray-400 mb-1">MT5 Account</p>
					<p class="text-sm text-white font-mono">{clientAccount.mt5_account_id}</p>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-400 mb-1">เซิร์ฟเวอร์</p>
					<p class="text-sm text-white">{clientAccount.mt5_server}</p>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-400 mb-1">โบรกเกอร์</p>
					<p class="text-sm text-white">
						{getBrokerName(clientAccount)}
					</p>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-400 mb-1">ชื่อบัญชี</p>
					<p class="text-sm text-white">{clientAccount.client_name}</p>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-400 mb-1">สถานะ</p>
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full {clientAccount.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}"></span>
						<p class="text-sm text-white">
							{clientAccount.status === 'approved' ? 'อนุมัติแล้ว' : clientAccount.status === 'pending' ? 'รอดำเนินการ' : clientAccount.status}
						</p>
					</div>
				</div>
				<div class="rounded-lg bg-dark-bg p-4">
					<p class="text-xs text-gray-400 mb-1">ซิงค์ล่าสุด</p>
					<p class="text-sm text-white">{formatSyncDate(clientAccount.last_synced_at)}</p>
				</div>
			</div>
			{#if clientAccount.sync_count > 0}
				<p class="text-xs text-gray-400 mt-3">ซิงค์ทั้งหมด {clientAccount.sync_count.toLocaleString()} ครั้ง</p>
			{/if}
		{:else}
			<!-- Empty state -->
			<div class="text-center py-8">
				<svg class="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				<p class="text-sm text-gray-400 mb-1">ยังไม่มีบัญชีเทรดที่เชื่อมต่อ</p>
				<p class="text-xs text-gray-400">กรุณาติดต่อ IB ของคุณเพื่อเชื่อมต่อบัญชี MT5</p>
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
					<p class="text-xs text-gray-400">รับแจ้งเตือนผ่านเบราว์เซอร์</p>
				</div>
				<button
					onclick={() => {
						pushEnabled = !pushEnabled;
						if (pushEnabled) openPushPermissionPrompt();
					}}
					class="w-11 h-6 rounded-full transition-colors relative {pushEnabled ? 'bg-brand-primary' : 'bg-dark-bg border border-dark-border'}"
					role="switch"
					aria-checked={pushEnabled}
					aria-label="การแจ้งเตือนผ่าน Push"
				>
					<div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {pushEnabled ? 'left-[22px]' : 'left-0.5'}"></div>
				</button>
			</div>

			<div class="rounded-xl border border-dark-border bg-dark-bg/30 p-4">
				<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">หมวด Push Notification</p>
				<div class="grid gap-3 md:grid-cols-2">
					{#each [
						{ label: 'สถานะ Sync', desc: 'สำเร็จ ล้มเหลว หรือมีรายการรอซิงก์', get: () => syncStatusEnabled, set: (v: boolean) => syncStatusEnabled = v },
						{ label: 'Risk threshold', desc: 'แจ้งเตือนเมื่อแตะเกณฑ์ความเสี่ยง', get: () => riskThresholdEnabled, set: (v: boolean) => riskThresholdEnabled = v },
						{ label: 'สถานะบัญชี', desc: 'อนุมัติบัญชีหรือข้อมูลสำคัญจากระบบ', get: () => accountStatusEnabled, set: (v: boolean) => accountStatusEnabled = v },
						{ label: 'เตือนเขียน Journal', desc: 'เตือนบันทึกหลังจบวันเทรด', get: () => journalReminderEnabled, set: (v: boolean) => journalReminderEnabled = v },
						{ label: 'AI insight', desc: 'แจ้งเมื่อ TradePilot สรุป insight พร้อม', get: () => aiInsightEnabled, set: (v: boolean) => aiInsightEnabled = v }
					] as pref}
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<p class="text-sm text-white">{pref.label}</p>
								<p class="text-xs text-gray-400">{pref.desc}</p>
							</div>
							<button
								type="button"
								onclick={() => pref.set(!pref.get())}
								class="relative h-6 w-11 shrink-0 rounded-full transition-colors {pref.get() ? 'bg-brand-primary' : 'bg-dark-bg border border-dark-border'}"
								role="switch"
								aria-checked={pref.get()}
								aria-label={pref.label}
							>
								<div class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform {pref.get() ? 'left-[22px]' : 'left-0.5'}"></div>
							</button>
						</div>
					{/each}
				</div>
			</div>

			<!-- Daily Email -->
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-white">อีเมลสรุปรายวัน</p>
					<p class="text-xs text-gray-400">รับสรุปผลเทรดทุกสิ้นวัน</p>
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
					<p class="text-xs text-gray-400">รับแจ้งเตือนเมื่อมีเทรดใหม่หรือปิดเทรด</p>
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
					<p class="text-xs text-gray-400">รับสรุปผลการเทรดรายสัปดาห์ทุกวันจันทร์</p>
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
						syncStatusEnabled = notificationPrefs?.sync_status_enabled ?? true;
						riskThresholdEnabled = notificationPrefs?.risk_threshold_enabled ?? true;
						accountStatusEnabled = notificationPrefs?.account_status_enabled ?? true;
						journalReminderEnabled = notificationPrefs?.journal_reminder_enabled ?? false;
						aiInsightEnabled = notificationPrefs?.ai_insight_enabled ?? true;
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

	<!-- Webhook Integrations -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-2 mb-1">
			<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
			</svg>
			<h2 class="text-lg font-semibold">Webhook</h2>
		</div>
		<p class="text-xs text-gray-400 mb-5">รับการแจ้งเตือนการเทรดผ่าน LINE Notify หรือ Discord Webhook</p>

		{#if webhookLoading}
			<div class="flex items-center gap-2 text-sm text-gray-400 py-4">
				<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				กำลังโหลด...
			</div>
		{:else}
			<div class="space-y-6">
				{#each ([['line', 'LINE Notify', 'https://notify-api.line.me/api/notify'], ['discord', 'Discord Webhook', 'https://discord.com/api/webhooks/...']] as const) as [type, label, placeholder]}
					<div class="rounded-lg border border-dark-border p-4">
						<!-- Header -->
						<div class="flex items-center justify-between mb-3">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-white">{label}</span>
								{#if webhookConfigs[type]}
									<span class="px-1.5 py-0.5 rounded text-xs font-medium {webhookActiveInputs[type] ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}">
										{webhookActiveInputs[type] ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
									</span>
								{/if}
							</div>
							<!-- Active toggle (only if config exists) -->
							{#if webhookConfigs[type]}
								<button
									onclick={() => { webhookActiveInputs[type] = !webhookActiveInputs[type]; }}
									class="w-11 h-6 rounded-full transition-colors relative {webhookActiveInputs[type] ? 'bg-brand-primary' : 'bg-dark-bg border border-dark-border'}"
									role="switch"
									aria-checked={webhookActiveInputs[type]}
									aria-label="เปิด/ปิด {label}"
								>
									<div class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {webhookActiveInputs[type] ? 'left-[22px]' : 'left-0.5'}"></div>
								</button>
							{/if}
						</div>

						<!-- URL Input -->
						<div class="mb-3">
							<label class="label text-xs" for="webhook-url-{type}">Webhook URL</label>
							<input
								id="webhook-url-{type}"
								type="url"
								bind:value={webhookUrlInputs[type]}
								{placeholder}
								class="input font-mono text-xs"
								disabled={webhookSaving[type]}
							/>
						</div>

						<!-- Events checkboxes -->
						<div class="mb-4">
							<p class="label text-xs mb-2">รับการแจ้งเตือนเมื่อ</p>
							<div class="flex flex-wrap gap-3">
								{#each ALL_EVENTS as ev}
									<label class="flex items-center gap-2 cursor-pointer select-none">
										<input
											type="checkbox"
											class="w-4 h-4 rounded border border-dark-border accent-brand-primary"
											checked={webhookEventsInputs[type].includes(ev.value)}
											onchange={() => toggleWebhookEvent(type, ev.value)}
											disabled={webhookSaving[type]}
										/>
										<span class="text-xs text-gray-300">{ev.label}</span>
									</label>
								{/each}
							</div>
						</div>

						<!-- Action buttons -->
						<div class="flex items-center gap-2 flex-wrap">
							<button
								onclick={() => saveWebhook(type)}
								disabled={webhookSaving[type] || !webhookUrlInputs[type]}
								class="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
							>
								{#if webhookSaving[type]}
									<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{/if}
								บันทึก
							</button>

							{#if webhookConfigs[type]}
								<button
									onclick={() => testWebhook(type)}
									disabled={webhookTesting[type] || webhookSaving[type]}
									class="px-3 py-1.5 rounded-lg border border-dark-border text-gray-300 text-xs hover:text-white hover:bg-dark-hover disabled:opacity-50 transition-colors flex items-center gap-1.5"
								>
									{#if webhookTesting[type]}
										<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
									{:else}
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
									{/if}
									ทดสอบ
								</button>

								<button
									onclick={() => deleteWebhook(type)}
									disabled={webhookSaving[type]}
									class="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 disabled:opacity-50 transition-colors"
								>
									ลบ
								</button>
							{/if}
						</div>

						{#if webhookMessages[type]}
							<p class="text-xs mt-2 {webhookMessages[type]?.type === 'success' ? 'text-green-400' : 'text-red-400'}">
								{webhookMessages[type]?.text}
							</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- API Keys -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-2 mb-1">
			<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
			</svg>
			<h2 class="text-lg font-semibold">API Keys</h2>
		</div>
		<p class="text-xs text-gray-400 mb-5">สร้าง API Key เพื่อเข้าถึงข้อมูลพอร์ตโฟลิโอผ่าน REST API (read-only)</p>

		{#if apiKeyMessage}
			<div class="mb-4 p-3 rounded-lg text-xs {apiKeyMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}">
				{apiKeyMessage.text}
			</div>
		{/if}

		<!-- Newly created key reveal -->
		{#if newKeyRevealed}
			<div class="mb-5 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
				<p class="text-sm font-medium text-yellow-400 mb-2">บันทึกคีย์นี้ไว้ จะไม่แสดงอีก</p>
				<div class="flex items-center gap-2">
					<code class="flex-1 text-xs bg-dark-bg rounded px-3 py-2 text-white font-mono break-all select-all">{newKeyRevealed}</code>
					<button
						onclick={() => copyToClipboard(newKeyRevealed!)}
						class="shrink-0 px-3 py-2 rounded-lg border border-dark-border text-gray-300 text-xs hover:text-white hover:bg-dark-hover transition-colors"
					>
						คัดลอก
					</button>
				</div>
				<button
					onclick={() => newKeyRevealed = null}
					class="mt-2 text-xs text-gray-400 hover:text-white transition-colors"
				>
					ปิด
				</button>
			</div>
		{/if}

		<!-- Create new key -->
		<div class="flex items-end gap-2 mb-5">
			<div class="flex-1">
				<label class="label text-xs" for="api-key-name">ชื่อ API Key</label>
				<input
					id="api-key-name"
					type="text"
					bind:value={newKeyName}
					placeholder="e.g. My Trading Bot"
					class="input text-sm"
					maxlength={100}
					disabled={creatingKey}
					onkeydown={(e) => { if (e.key === 'Enter') createApiKey(); }}
				/>
			</div>
			<button
				onclick={createApiKey}
				disabled={creatingKey || !newKeyName.trim()}
				class="shrink-0 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
			>
				{#if creatingKey}
					<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				{/if}
				สร้าง API Key ใหม่
			</button>
		</div>

		<!-- Existing keys table -->
		{#if apiKeys.length > 0}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-dark-border text-xs text-gray-400">
							<th class="text-left py-2 pr-3 font-medium">ชื่อ</th>
							<th class="text-left py-2 pr-3 font-medium">Key</th>
							<th class="text-left py-2 pr-3 font-medium hidden sm:table-cell">Scopes</th>
							<th class="text-left py-2 pr-3 font-medium hidden md:table-cell">ใช้ล่าสุด</th>
							<th class="text-left py-2 pr-3 font-medium hidden md:table-cell">สร้างเมื่อ</th>
							<th class="text-right py-2 font-medium">จัดการ</th>
						</tr>
					</thead>
					<tbody>
						{#each apiKeys as key (key.id)}
							<tr class="border-b border-dark-border/50 {!key.is_active ? 'opacity-40' : ''}">
								<td class="py-3 pr-3">
									<span class="text-white">{key.name}</span>
									{#if !key.is_active}
										<span class="ml-1 text-xs text-red-400">(ยกเลิกแล้ว)</span>
									{/if}
									{#if key.expires_at && new Date(key.expires_at) < new Date()}
										<span class="ml-1 text-xs text-yellow-400">(หมดอายุ)</span>
									{/if}
								</td>
								<td class="py-3 pr-3">
									<code class="text-xs font-mono text-gray-300">{key.key_prefix}...</code>
								</td>
								<td class="py-3 pr-3 hidden sm:table-cell">
									<div class="flex flex-wrap gap-1">
										{#each key.scopes as scope}
											<span class="px-1.5 py-0.5 rounded text-xs bg-dark-bg text-gray-300">{scope}</span>
										{/each}
									</div>
								</td>
								<td class="py-3 pr-3 text-xs text-gray-400 hidden md:table-cell">{formatKeyDate(key.last_used_at)}</td>
								<td class="py-3 pr-3 text-xs text-gray-400 hidden md:table-cell">{formatKeyDate(key.created_at)}</td>
								<td class="py-3 text-right">
									{#if key.is_active}
										{#if confirmRevokeId === key.id}
											<div class="flex items-center justify-end gap-1">
												<span class="text-xs text-yellow-400 mr-1">ยืนยัน?</span>
												<button
													onclick={() => revokeApiKey(key.id)}
													disabled={revokingId === key.id}
													class="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
												>
													{revokingId === key.id ? '...' : 'ใช่'}
												</button>
												<button
													onclick={() => confirmRevokeId = null}
													class="px-2 py-1 rounded text-xs border border-dark-border text-gray-400 hover:text-white transition-colors"
												>
													ไม่
												</button>
											</div>
										{:else}
											<button
												onclick={() => confirmRevokeId = key.id}
												class="px-2 py-1 rounded text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
											>
												ยกเลิก
											</button>
										{/if}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="text-center py-6">
				<p class="text-sm text-gray-400">ยังไม่มี API Key</p>
				<p class="text-xs text-gray-500 mt-1">สร้าง API Key เพื่อเข้าถึงข้อมูลผ่าน REST API</p>
			</div>
		{/if}
	</div>

	<!-- My Data Export -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-2 mb-4">
			<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
			</svg>
			<h2 class="text-lg font-semibold">ข้อมูลของฉัน</h2>
		</div>

		<p class="text-sm text-gray-400 mb-4">
			ดาวน์โหลดข้อมูลทั้งหมดของคุณในรูปแบบ JSON และ CSV
		</p>

		{#if clientAccount}
			<p class="text-xs text-gray-500 mb-4">
				ไฟล์ ZIP ประกอบด้วย: เทรด, บันทึกรายวัน, สถิติรายวัน, เพลย์บุ๊ก และ checklist
			</p>
		{/if}

		<button
			onclick={downloadExport}
			disabled={exporting || !clientAccount}
			class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
		>
			{#if exporting}
				<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				กำลังเตรียมไฟล์...
			{:else}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
				ดาวน์โหลดข้อมูล
			{/if}
		</button>

		{#if !clientAccount}
			<p class="text-xs text-gray-500 mt-2">ต้องมีบัญชีเทรดที่อนุมัติแล้วจึงจะดาวน์โหลดได้</p>
		{/if}

		{#if exportMessage}
			<p class="text-xs mt-3 {exportMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}">
				{exportMessage.text}
			</p>
		{/if}
	</div>
</div>
