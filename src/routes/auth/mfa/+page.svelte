<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();
	let code = $state('');
	let loading = $state(false);
	let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

	const canSubmit = $derived(/^\d{6}$/.test(code) && !loading);

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!canSubmit) return;

		loading = true;
		message = null;

		try {
			const res = await fetch('/api/auth/mfa', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'verify-totp',
					code,
					returnTo: data.returnTo
				})
			});
			const result = await res.json();

			if (!res.ok) {
				message = { type: 'error', text: result.message || 'ไม่สามารถยืนยันตัวตนได้' };
				return;
			}

			message = { type: 'success', text: result.message || 'ยืนยันตัวตนสำเร็จ' };
			await goto(result.redirectTo || '/', { replaceState: true, invalidateAll: true });
		} catch {
			message = { type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>ยืนยันตัวตน 2FA - IB Portal</title>
</svelte:head>

<div class="min-h-screen bg-dark-bg flex items-center justify-center p-4">
	<div class="w-full max-w-md rounded-2xl border border-dark-border bg-dark-surface p-6 sm:p-8">
		<div class="mb-6 flex items-center gap-3">
			<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary/10">
				<svg class="h-6 w-6 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 .552-.448 1-1 1s-1-.448-1-1 .448-1 1-1 1 .448 1 1zm0 0V8m-6 4a9 9 0 1118 0 9 9 0 01-18 0zm9 6h.01" />
				</svg>
			</div>
			<div>
				<h1 class="text-xl font-semibold text-white">ยืนยันตัวตนสองขั้นตอน</h1>
				<p class="text-sm text-gray-400">กรอกรหัส 6 หลักจากแอป Authenticator เพื่อเข้าสู่ระบบต่อ</p>
			</div>
		</div>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label class="label" for="totp-code">รหัสยืนยัน</label>
				<input
					id="totp-code"
					type="text"
					inputmode="numeric"
					autocomplete="one-time-code"
					maxlength="6"
					placeholder="000000"
					bind:value={code}
					class="input text-center text-lg tracking-[0.4em]"
				/>
				<p class="mt-2 text-xs text-gray-400">รองรับแอปเช่น Google Authenticator, Microsoft Authenticator หรือ Authy</p>
			</div>

			{#if message}
				<div class="rounded-lg border px-4 py-3 text-sm {message.type === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}">
					{message.text}
				</div>
			{/if}

			<button
				type="submit"
				disabled={!canSubmit}
				class="btn-primary w-full disabled:cursor-not-allowed disabled:bg-dark-border disabled:text-gray-400"
			>
				{loading ? 'กำลังตรวจสอบ...' : 'ยืนยันและเข้าสู่ระบบ'}
			</button>
		</form>

		<form method="POST" action="/auth/logout" class="mt-4">
			<button type="submit" class="w-full rounded-lg border border-dark-border px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-dark-bg">
				ออกจากระบบ
			</button>
		</form>
	</div>
</div>
