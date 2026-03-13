<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

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
			<p class="text-gray-500 mt-2">เข้าสู่ระบบเพื่อจัดการพอร์ต</p>
		</div>

		<form onsubmit={handleLogin} class="card space-y-4">
			{#if error}
				<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
					{error}
				</div>
			{/if}

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
