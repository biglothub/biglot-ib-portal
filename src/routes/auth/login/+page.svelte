<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let googleLoading = $state(false);
	let error = $state('');

	// Show error from URL params (e.g. after failed Google OAuth)
	const urlError = $derived($page.url.searchParams.get('error'));
	const urlErrorMessage = $derived(
		urlError === 'no_account'
			? 'ไม่พบบัญชีที่ได้รับอนุมัติสำหรับอีเมลนี้ กรุณาติดต่อ IB ของคุณ'
			: urlError === 'google_auth_failed'
				? 'การเข้าสู่ระบบด้วย Google ล้มเหลว กรุณาลองใหม่'
				: ''
	);

	async function handleGoogleLogin() {
		googleLoading = true;
		error = '';

		const { error: oauthError } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback`
			}
		});

		if (oauthError) {
			error = 'ไม่สามารถเชื่อมต่อ Google ได้ กรุณาลองใหม่';
			googleLoading = false;
		}
	}

	async function handleLogin(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const { error: authError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (authError) {
			error = authError.message === 'Invalid login credentials'
				? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
				: authError.message;
			loading = false;
			return;
		}

		goto('/', { replaceState: true, invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Login - IB Portal</title>
</svelte:head>

<div class="min-h-screen bg-dark-bg flex items-center justify-center p-4">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<h1 class="text-2xl font-bold text-white">IB Portal</h1>
			<p class="text-gray-400 mt-2">เข้าสู่ระบบเพื่อจัดการพอร์ต</p>
		</div>

		<div class="card space-y-4">
			{#if error || urlErrorMessage}
				<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
					{error || urlErrorMessage}
				</div>
			{/if}

			<!-- Google Sign In (for clients) -->
			<button
				onclick={handleGoogleLogin}
				disabled={googleLoading}
				class="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-lg transition-colors disabled:opacity-50"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
				</svg>
				{googleLoading ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}
			</button>

			<!-- Divider -->
			<div class="relative">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-dark-border"></div>
				</div>
				<div class="relative flex justify-center text-sm">
					<span class="px-3 bg-dark-surface text-gray-400">สำหรับ Admin / IB</span>
				</div>
			</div>

			<!-- Email/Password Form (for admin & IB) -->
			<form onsubmit={handleLogin} class="space-y-4">
				<div>
					<label for="email" class="label">อีเมล</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						class="input"
						placeholder="email@example.com"
						required
					/>
				</div>

				<div>
					<label for="password" class="label">รหัสผ่าน</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						class="input"
						placeholder="รหัสผ่าน"
						required
					/>
				</div>

				<button
					type="submit"
					class="btn-primary w-full"
					disabled={loading}
				>
					{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
				</button>
			</form>
		</div>
	</div>
</div>
