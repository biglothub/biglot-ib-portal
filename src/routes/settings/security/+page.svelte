<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	type Message = { type: 'success' | 'error'; text: string };

	let { data } = $props();
	let provider = $derived(data.provider);
	let lastSignIn = $derived(data.lastSignIn);

	// Password change form
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let passwordLoading = $state(false);
	let passwordMessage = $state<Message | null>(null);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);

	// 2FA state
	let didInitMfa = $state(false);
	let mfaEnabled = $state(false);
	let mfaFactorId = $state<string | null>(null);
	let mfaFriendlyName = $state<string | null>(null);
	let hasUnverifiedFactor = $state(false);
	let pendingFactorId = $state<string | null>(null);
	let pendingQrCode = $state<string | null>(null);
	let pendingSecret = $state<string | null>(null);
	let pendingUri = $state<string | null>(null);
	let setupCode = $state('');
	let disableCode = $state('');
	let mfaLoading = $state(false);
	let mfaMessage = $state<Message | null>(null);

	const isOAuthUser = $derived(provider === 'google' || provider === 'github' || provider === 'facebook');
	const passwordsMatch = $derived(newPassword === confirmPassword);
	const passwordValid = $derived(newPassword.length >= 8);
	const canSubmitPassword = $derived(
		!isOAuthUser && currentPassword.length > 0 && newPassword.length > 0 && passwordsMatch && passwordValid && !passwordLoading
	);
	const hasLiveSetup = $derived(Boolean(pendingFactorId && pendingQrCode && pendingSecret));
	const canVerifySetup = $derived(/^\d{6}$/.test(setupCode) && !mfaLoading && Boolean(pendingFactorId));
	const canDisable2fa = $derived(/^\d{6}$/.test(disableCode) && !mfaLoading && mfaEnabled);
	const qrCodeDataUrl = $derived(
		pendingQrCode ? `data:image/svg+xml;utf8,${encodeURIComponent(pendingQrCode)}` : ''
	);

	$effect(() => {
		if (didInitMfa) return;

		mfaEnabled = data.mfa.enabled;
		mfaFactorId = data.mfa.factorId;
		mfaFriendlyName = data.mfa.friendlyName;
		hasUnverifiedFactor = data.mfa.hasUnverifiedFactor;
		didInitMfa = true;
	});

	async function postSecurityAction(payload: Record<string, unknown>) {
		const res = await fetch('/api/settings/security', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		const result = await res.json();
		return { res, result };
	}

	async function handlePasswordChange(e: Event) {
		e.preventDefault();
		if (!canSubmitPassword) return;

		passwordLoading = true;
		passwordMessage = null;

		try {
			const { res, result } = await postSecurityAction({
				action: 'change-password',
				currentPassword: currentPassword || undefined,
				newPassword
			});

			if (res.ok) {
				passwordMessage = { type: 'success', text: result.message };
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
			} else {
				passwordMessage = { type: 'error', text: result.message };
			}
		} catch {
			passwordMessage = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			passwordLoading = false;
		}
	}

	async function start2faSetup() {
		mfaLoading = true;
		mfaMessage = null;

		try {
			const { res, result } = await postSecurityAction({ action: '2fa-enroll' });
			if (!res.ok) {
				mfaMessage = { type: 'error', text: result.message };
				return;
			}

			pendingFactorId = result.factorId;
			pendingQrCode = result.qrCode;
			pendingSecret = result.secret;
			pendingUri = result.uri;
			setupCode = '';
			hasUnverifiedFactor = true;
			mfaMessage = { type: 'success', text: result.message };
		} catch {
			mfaMessage = { type: 'error', text: 'ไม่สามารถเริ่มเปิดใช้งาน 2FA ได้' };
		} finally {
			mfaLoading = false;
		}
	}

	async function verify2faSetup(event: Event) {
		event.preventDefault();
		if (!canVerifySetup || !pendingFactorId) return;

		mfaLoading = true;
		mfaMessage = null;

		try {
			const { res, result } = await postSecurityAction({
				action: '2fa-verify-enroll',
				factorId: pendingFactorId,
				code: setupCode
			});
			if (!res.ok) {
				mfaMessage = { type: 'error', text: result.message };
				return;
			}

			mfaEnabled = true;
			mfaFactorId = pendingFactorId;
			mfaFriendlyName = 'Authenticator App';
			hasUnverifiedFactor = false;
			pendingFactorId = null;
			pendingQrCode = null;
			pendingSecret = null;
			pendingUri = null;
			setupCode = '';
			mfaMessage = { type: 'success', text: result.message };
			await invalidateAll();
		} catch {
			mfaMessage = { type: 'error', text: 'ไม่สามารถยืนยันการเปิดใช้งาน 2FA ได้' };
		} finally {
			mfaLoading = false;
		}
	}

	async function disable2fa(event: Event) {
		event.preventDefault();
		if (!canDisable2fa) return;

		mfaLoading = true;
		mfaMessage = null;

		try {
			const { res, result } = await postSecurityAction({
				action: '2fa-disable',
				code: disableCode
			});
			if (!res.ok) {
				mfaMessage = { type: 'error', text: result.message };
				return;
			}

			mfaEnabled = false;
			mfaFactorId = null;
			mfaFriendlyName = null;
			hasUnverifiedFactor = false;
			pendingFactorId = null;
			pendingQrCode = null;
			pendingSecret = null;
			pendingUri = null;
			disableCode = '';
			mfaMessage = { type: 'success', text: result.message };
			await invalidateAll();
		} catch {
			mfaMessage = { type: 'error', text: 'ไม่สามารถปิดการใช้งาน 2FA ได้' };
		} finally {
			mfaLoading = false;
		}
	}

	function formatDate(dateStr: string | null) {
		if (!dateStr) return '-';
		return new Date(dateStr).toLocaleString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="space-y-6">
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary/10">
				<svg class="h-5 w-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">เปลี่ยนรหัสผ่าน</h2>
				<p class="text-xs text-gray-400">จัดการรหัสผ่านสำหรับเข้าสู่ระบบ</p>
			</div>
		</div>

		{#if isOAuthUser}
			<div class="rounded-lg border border-dark-border bg-dark-bg p-4">
				<div class="flex items-start gap-3">
					<svg class="mt-0.5 h-5 w-5 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<p class="text-sm text-white">ลงชื่อเข้าใช้ผ่าน {provider === 'google' ? 'Google' : provider === 'github' ? 'GitHub' : 'OAuth'}</p>
						<p class="mt-1 text-xs text-gray-400">
							บัญชีของคุณเชื่อมต่อผ่าน {provider === 'google' ? 'Google' : provider} จึงไม่สามารถเปลี่ยนรหัสผ่านได้ที่นี่
							กรุณาจัดการรหัสผ่านที่ผู้ให้บริการของคุณ
						</p>
					</div>
				</div>
			</div>
		{:else}
			<form onsubmit={handlePasswordChange} class="max-w-md space-y-4">
				<div>
					<label class="label" for="current-password">รหัสผ่านปัจจุบัน</label>
					<div class="relative">
						<input
							id="current-password"
							type={showCurrentPassword ? 'text' : 'password'}
							bind:value={currentPassword}
							placeholder="กรอกรหัสผ่านปัจจุบัน"
							autocomplete="current-password"
							class="input pr-10"
						/>
						<button
							type="button"
							onclick={() => showCurrentPassword = !showCurrentPassword}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-300"
						>
							{#if showCurrentPassword}
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
								</svg>
							{:else}
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<div>
					<label class="label" for="new-password">รหัสผ่านใหม่</label>
					<div class="relative">
						<input
							id="new-password"
							type={showNewPassword ? 'text' : 'password'}
							bind:value={newPassword}
							placeholder="อย่างน้อย 8 ตัวอักษร"
							autocomplete="new-password"
							class="input pr-10"
						/>
						<button
							type="button"
							onclick={() => showNewPassword = !showNewPassword}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-300"
						>
							{#if showNewPassword}
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
								</svg>
							{:else}
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							{/if}
						</button>
					</div>
					{#if newPassword.length > 0 && !passwordValid}
						<p class="mt-1 text-xs text-red-400">รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร</p>
					{/if}
				</div>

				<div>
					<label class="label" for="confirm-password">ยืนยันรหัสผ่านใหม่</label>
					<input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
						autocomplete="new-password"
						class="input"
					/>
					{#if confirmPassword.length > 0 && !passwordsMatch}
						<p class="mt-1 text-xs text-red-400">รหัสผ่านไม่ตรงกัน</p>
					{/if}
				</div>

				{#if passwordMessage}
					<div class="rounded-lg border px-4 py-3 text-sm {passwordMessage.type === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}">
						{passwordMessage.text}
					</div>
				{/if}

				<button
					type="submit"
					disabled={!canSubmitPassword}
					class="rounded-lg px-5 py-2.5 text-sm font-medium transition-colors
						{canSubmitPassword
							? 'bg-brand-primary text-black hover:bg-brand-primary/90'
							: 'cursor-not-allowed bg-dark-border text-gray-400'}"
				>
					{#if passwordLoading}
						<span class="flex items-center gap-2">
							<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
							</svg>
							กำลังบันทึก...
						</span>
					{:else}
						เปลี่ยนรหัสผ่าน
					{/if}
				</button>
			</form>
		{/if}
	</div>

	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
				<svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">เซสชันที่ใช้งาน</h2>
				<p class="text-xs text-gray-400">อุปกรณ์ที่เข้าสู่ระบบอยู่</p>
			</div>
		</div>

		<div class="space-y-3">
			<div class="rounded-lg border border-dark-border bg-dark-bg p-4">
				<div class="flex items-center justify-between gap-4">
					<div class="flex items-center gap-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
							<svg class="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
						</div>
						<div>
							<p class="text-sm text-white">เซสชันปัจจุบัน</p>
							<p class="text-xs text-gray-400">เข้าสู่ระบบล่าสุด: {formatDate(lastSignIn)}</p>
						</div>
					</div>
					<span class="flex items-center gap-1.5 text-xs text-green-400">
						<span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
						ใช้งานอยู่
					</span>
				</div>
			</div>

			<div class="pt-2">
				<form method="POST" action="/auth/logout">
					<button
						type="submit"
						class="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
					>
						ออกจากระบบทุกอุปกรณ์
					</button>
				</form>
			</div>
		</div>
	</div>

	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
				<svg class="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">การยืนยันตัวตนสองขั้นตอน (2FA)</h2>
				<p class="text-xs text-gray-400">เพิ่มความปลอดภัยให้บัญชีของคุณด้วยแอป Authenticator</p>
			</div>
		</div>

		<div class="rounded-lg border border-dark-border bg-dark-bg p-4">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-start gap-3">
					<svg class="mt-0.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
					</svg>
					<div>
						<p class="text-sm text-white">{mfaFriendlyName || 'แอปยืนยันตัวตน'}</p>
						<p class="text-xs text-gray-400">รองรับ Google Authenticator, Microsoft Authenticator และ Authy</p>
					</div>
				</div>

				<div class="flex items-center gap-3">
					{#if mfaEnabled}
						<span class="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
							เปิดใช้งานแล้ว
						</span>
					{:else if hasLiveSetup || hasUnverifiedFactor}
						<span class="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
							รอยืนยัน
						</span>
					{:else}
						<span class="rounded-full border border-dark-border bg-dark-surface px-2 py-0.5 text-xs font-medium text-gray-400">
							ยังไม่เปิดใช้
						</span>
					{/if}
				</div>
			</div>
		</div>

		<div class="mt-4 space-y-4">
			{#if mfaMessage}
				<div class="rounded-lg border px-4 py-3 text-sm {mfaMessage.type === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}">
					{mfaMessage.text}
				</div>
			{/if}

			{#if mfaEnabled}
				<div class="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
					<p class="text-sm text-white">2FA ของคุณเปิดใช้งานอยู่แล้ว</p>
					<p class="mt-1 text-xs text-gray-400">ทุกครั้งที่เข้าสู่ระบบจากเซสชันใหม่ ระบบจะขอรหัส 6 หลักจากแอป Authenticator เพิ่มอีกขั้น</p>
				</div>

				<form onsubmit={disable2fa} class="max-w-md space-y-3">
					<div>
						<label class="label" for="disable-2fa-code">รหัสจากแอป Authenticator เพื่อปิด 2FA</label>
						<input
							id="disable-2fa-code"
							type="text"
							inputmode="numeric"
							maxlength="6"
							placeholder="000000"
							bind:value={disableCode}
							class="input"
						/>
					</div>

					<button
						type="submit"
						disabled={!canDisable2fa}
						class="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{mfaLoading ? 'กำลังปิดการใช้งาน...' : 'ปิดการใช้งาน 2FA'}
					</button>
				</form>
			{:else if hasLiveSetup}
				<div class="grid gap-4 lg:grid-cols-[220px,1fr]">
					<div class="rounded-lg border border-dark-border bg-white p-3">
						<img src={qrCodeDataUrl} alt="QR code สำหรับเปิดใช้งาน 2FA" class="h-auto w-full" />
					</div>

					<div class="space-y-4">
						<div class="rounded-lg border border-dark-border bg-dark-bg p-4">
							<p class="text-sm text-white">1. สแกน QR code ด้วยแอป Authenticator</p>
							<p class="mt-1 text-xs text-gray-400">ถ้าสแกนไม่ได้ ให้เพิ่มบัญชีแบบ manual ด้วย secret key ด้านล่าง</p>
							<div class="mt-3 rounded-lg border border-dark-border bg-dark-surface px-3 py-2 font-mono text-sm text-brand-primary break-all">
								{pendingSecret}
							</div>
							{#if pendingUri}
								<p class="mt-2 text-[11px] text-gray-500 break-all">{pendingUri}</p>
							{/if}
						</div>

						<form onsubmit={verify2faSetup} class="max-w-md space-y-3">
							<div>
								<label class="label" for="setup-2fa-code">2. กรอกรหัส 6 หลักเพื่อยืนยันการเปิดใช้งาน</label>
								<input
									id="setup-2fa-code"
									type="text"
									inputmode="numeric"
									maxlength="6"
									placeholder="000000"
									bind:value={setupCode}
									class="input"
								/>
							</div>

							<div class="flex flex-wrap gap-3">
								<button
									type="submit"
									disabled={!canVerifySetup}
									class="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:bg-dark-border disabled:text-gray-400"
								>
									{mfaLoading ? 'กำลังยืนยัน...' : 'ยืนยันและเปิดใช้งาน 2FA'}
								</button>

								<button
									type="button"
									onclick={start2faSetup}
									disabled={mfaLoading}
									class="rounded-lg border border-dark-border px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-dark-surface disabled:cursor-not-allowed disabled:opacity-50"
								>
									สร้าง QR ใหม่
								</button>
							</div>
						</form>
					</div>
				</div>
			{:else if hasUnverifiedFactor}
				<div class="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
					<p class="text-sm text-yellow-300">พบคำขอเปิดใช้งาน 2FA ที่ยังยืนยันไม่เสร็จ</p>
					<p class="mt-1 text-xs text-yellow-100/70">เพื่อความปลอดภัย ระบบจะสร้าง QR code ใหม่และแทนที่คำขอเดิมเมื่อคุณเริ่ม setup อีกครั้ง</p>
				</div>

				<button
					type="button"
					onclick={start2faSetup}
					disabled={mfaLoading}
					class="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:bg-dark-border disabled:text-gray-400"
				>
					{mfaLoading ? 'กำลังเตรียม QR code...' : 'เริ่มตั้งค่า 2FA ใหม่'}
				</button>
			{:else}
				<div class="rounded-lg border border-dark-border bg-dark-bg p-4">
					<p class="text-sm text-white">เปิดใช้ 2FA เพื่อเพิ่มการป้องกันเมื่อรหัสผ่านรั่วไหลหรือมีการเข้าสู่ระบบจากอุปกรณ์ใหม่</p>
					<p class="mt-1 text-xs text-gray-400">ระบบจะขอรหัส 6 หลักจากแอป Authenticator หลังผ่านขั้นตอนล็อกอินปกติ</p>
				</div>

				<button
					type="button"
					onclick={start2faSetup}
					disabled={mfaLoading}
					class="rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:bg-dark-border disabled:text-gray-400"
				>
					{mfaLoading ? 'กำลังเตรียม QR code...' : 'เปิดใช้งาน 2FA'}
				</button>
			{/if}
		</div>

		<p class="mt-4 text-xs text-gray-400">
			หากเปลี่ยนโทรศัพท์หรือสูญเสียอุปกรณ์ กรุณาติดต่อทีมงานเพื่อรีเซ็ต 2FA ก่อนเข้าสู่ระบบอีกครั้ง
		</p>
	</div>

	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="mb-4 flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
				<svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">การเชื่อมต่อ</h2>
				<p class="text-xs text-gray-400">วิธีการเข้าสู่ระบบที่เชื่อมต่อแล้ว</p>
			</div>
		</div>

		<div class="rounded-lg border border-dark-border bg-dark-bg p-4">
			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					{#if provider === 'google'}
						<svg class="h-5 w-5" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
						</svg>
					{:else if provider === 'github'}
						<svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
						</svg>
					{:else}
						<svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
					{/if}
					<div>
						<p class="text-sm text-white">
							{provider === 'google' ? 'Google' : provider === 'github' ? 'GitHub' : 'อีเมล + รหัสผ่าน'}
						</p>
						<p class="text-xs text-gray-400">วิธีหลักในการเข้าสู่ระบบ</p>
					</div>
				</div>
				<span class="flex items-center gap-1.5 text-xs text-green-400">
					<span class="h-1.5 w-1.5 rounded-full bg-green-400"></span>
					เชื่อมต่อแล้ว
				</span>
			</div>
		</div>
	</div>
</div>
