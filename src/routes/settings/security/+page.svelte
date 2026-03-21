<script lang="ts">
	let { data } = $props();
	let { provider, lastSignIn } = $derived(data);

	// Password change form
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let passwordLoading = $state(false);
	let passwordMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);

	const isOAuthUser = $derived(provider === 'google' || provider === 'github' || provider === 'facebook');
	const passwordsMatch = $derived(newPassword === confirmPassword);
	const passwordValid = $derived(newPassword.length >= 8);
	const canSubmitPassword = $derived(
		!isOAuthUser && newPassword.length > 0 && passwordsMatch && passwordValid && !passwordLoading
	);

	async function handlePasswordChange(e: Event) {
		e.preventDefault();
		if (!canSubmitPassword) return;

		passwordLoading = true;
		passwordMessage = null;

		try {
			const res = await fetch('/api/settings/security', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'change-password',
					currentPassword: currentPassword || undefined,
					newPassword
				})
			});

			const result = await res.json();

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

<!-- Security Tab -->
<div class="space-y-6">
	<!-- Password Change -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center">
				<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">เปลี่ยนรหัสผ่าน</h2>
				<p class="text-xs text-gray-500">จัดการรหัสผ่านสำหรับเข้าสู่ระบบ</p>
			</div>
		</div>

		{#if isOAuthUser}
			<div class="rounded-lg bg-dark-bg border border-dark-border p-4">
				<div class="flex items-start gap-3">
					<svg class="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<p class="text-sm text-white">ลงชื่อเข้าใช้ผ่าน {provider === 'google' ? 'Google' : provider === 'github' ? 'GitHub' : 'OAuth'}</p>
						<p class="text-xs text-gray-500 mt-1">
							บัญชีของคุณเชื่อมต่อผ่าน {provider === 'google' ? 'Google' : provider} จึงไม่สามารถเปลี่ยนรหัสผ่านได้ที่นี่
							กรุณาจัดการรหัสผ่านที่ผู้ให้บริการของคุณ
						</p>
					</div>
				</div>
			</div>
		{:else}
			<form onsubmit={handlePasswordChange} class="space-y-4 max-w-md">
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
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
						>
							{#if showCurrentPassword}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
						>
							{#if showNewPassword}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							{/if}
						</button>
					</div>
					{#if newPassword.length > 0 && !passwordValid}
						<p class="text-xs text-red-400 mt-1">รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร</p>
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
						<p class="text-xs text-red-400 mt-1">รหัสผ่านไม่ตรงกัน</p>
					{/if}
				</div>

				{#if passwordMessage}
					<div class="rounded-lg px-4 py-3 text-sm {passwordMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}">
						{passwordMessage.text}
					</div>
				{/if}

				<button
					type="submit"
					disabled={!canSubmitPassword}
					class="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors
						{canSubmitPassword
							? 'bg-brand-primary text-black hover:bg-brand-primary/90'
							: 'bg-dark-border text-gray-500 cursor-not-allowed'}"
				>
					{#if passwordLoading}
						<span class="flex items-center gap-2">
							<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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

	<!-- Active Sessions -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
				<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">เซสชันที่ใช้งาน</h2>
				<p class="text-xs text-gray-500">อุปกรณ์ที่เข้าสู่ระบบอยู่</p>
			</div>
		</div>

		<div class="space-y-3">
			<!-- Current session -->
			<div class="rounded-lg bg-dark-bg border border-dark-border p-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
							<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
						</div>
						<div>
							<p class="text-sm text-white">เซสชันปัจจุบัน</p>
							<p class="text-xs text-gray-500">
								เข้าสู่ระบบล่าสุด: {formatDate(lastSignIn)}
							</p>
						</div>
					</div>
					<span class="flex items-center gap-1.5 text-xs text-green-400">
						<span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
						ใช้งานอยู่
					</span>
				</div>
			</div>

			<!-- Sign out all -->
			<div class="pt-2">
				<form method="POST" action="/auth/logout">
					<button
						type="submit"
						class="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
					>
						ออกจากระบบทุกอุปกรณ์
					</button>
				</form>
			</div>
		</div>
	</div>

	<!-- Two-Factor Authentication -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-3 mb-6">
			<div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
				<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">การยืนยันตัวตนสองขั้นตอน (2FA)</h2>
				<p class="text-xs text-gray-500">เพิ่มความปลอดภัยให้บัญชีของคุณ</p>
			</div>
		</div>

		<div class="rounded-lg bg-dark-bg border border-dark-border p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
					</svg>
					<div>
						<p class="text-sm text-white">Authenticator App</p>
						<p class="text-xs text-gray-500">ใช้แอปเช่น Google Authenticator หรือ Authy</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<span class="px-2 py-0.5 text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
						เร็ว ๆ นี้
					</span>
					<!-- Disabled toggle -->
					<div class="w-10 h-6 rounded-full bg-dark-bg border border-dark-border relative cursor-not-allowed opacity-40">
						<div class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-gray-500 transition-transform"></div>
					</div>
				</div>
			</div>
		</div>

		<p class="text-xs text-gray-600 mt-4">
			การยืนยันตัวตนสองขั้นตอนจะช่วยปกป้องบัญชีของคุณ แม้ว่ารหัสผ่านจะรั่วไหล
		</p>
	</div>

	<!-- Login Provider Info -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
				<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
				</svg>
			</div>
			<div>
				<h2 class="text-lg font-semibold">การเชื่อมต่อ</h2>
				<p class="text-xs text-gray-500">วิธีการเข้าสู่ระบบที่เชื่อมต่อแล้ว</p>
			</div>
		</div>

		<div class="rounded-lg bg-dark-bg border border-dark-border p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					{#if provider === 'google'}
						<svg class="w-5 h-5" viewBox="0 0 24 24">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
						</svg>
					{:else}
						<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
					{/if}
					<div>
						<p class="text-sm text-white">
							{provider === 'google' ? 'Google' : provider === 'github' ? 'GitHub' : 'อีเมล + รหัสผ่าน'}
						</p>
						<p class="text-xs text-gray-500">วิธีหลักในการเข้าสู่ระบบ</p>
					</div>
				</div>
				<span class="flex items-center gap-1.5 text-xs text-green-400">
					<span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
					เชื่อมต่อแล้ว
				</span>
			</div>
		</div>
	</div>
</div>
