<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { isMobile } from '$lib/pwa/platform';

	const WELCOME_SEEN_KEY = 'pwa.welcome.seen';

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let googleLoading = $state(false);
	let error = $state('');

	onMount(() => {
		// First-time mobile visitors see onboarding before the login form.
		// Skipped on desktop, on repeat visits, and when arriving with an error
		// (e.g. failed OAuth callback) so users always see the message.
		const hasError = $page.url.searchParams.has('error');
		if (!hasError && isMobile() && localStorage.getItem(WELCOME_SEEN_KEY) !== '1') {
			goto('/welcome', { replaceState: true });
		}
	});

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
			error =
				authError.message === 'Invalid login credentials'
					? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
					: authError.message;
			loading = false;
			return;
		}

		const { data: aalData, error: aalError } =
			await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
		if (aalError) {
			error = 'ไม่สามารถตรวจสอบสถานะการยืนยันตัวตนสองขั้นตอนได้';
			loading = false;
			return;
		}

		const nextPath =
			aalData?.currentLevel !== 'aal2' && aalData?.nextLevel === 'aal2' ? '/auth/mfa' : '/';

		goto(nextPath, { replaceState: true, invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Login - IB Portal</title>
</svelte:head>

<div class="login-root">
	<header class="topbar">
		<div class="brand"><span class="brand-dot"></span>IB PORTAL</div>
		<nav class="topbar-nav">
			<a href="mailto:support@ib-portal.app">ช่วยเหลือ</a>
		</nav>
	</header>

	<div class="stage">
		<div class="grid">
			<!-- ─── LEFT — STORY (desktop only) ─── -->
			<section class="story" aria-hidden="true">
				<div>
					<span class="eyebrow"><span class="pulse"></span>MT5 BRIDGE · LIVE</span>

					<h1 class="display">
						จัดการพอร์ต<br />
						อย่างที่ <em>มืออาชีพ</em><br />
						ทำกัน
					</h1>

					<p class="lede">
						IB Portal เชื่อมต่อกับ MetaTrader 5 ของคุณโดยตรง —
						<strong>ทุก trade เข้าระบบทันที</strong> พร้อม journal, AI coach, และ analytics
						ที่ออกแบบสำหรับ Introducing Brokers และลูกค้าระดับสถาบัน
					</p>

					<div class="hero-frame">
						<div class="card-equity">
							<div class="card-head">
								<span class="ticker">XAUUSD · 1H</span>
								<span class="pnl">+12.4%</span>
							</div>
							<svg viewBox="0 0 360 80" fill="none">
								<defs>
									<linearGradient id="loginLineGrad" x1="0" y1="0" x2="1" y2="0">
										<stop offset="0%" stop-color="#c9a84c" stop-opacity="0" />
										<stop offset="50%" stop-color="#c9a84c" />
										<stop offset="100%" stop-color="#c9a84c" stop-opacity="0" />
									</linearGradient>
									<linearGradient id="loginFillGrad" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stop-color="#c9a84c" stop-opacity="0.25" />
										<stop offset="100%" stop-color="#c9a84c" stop-opacity="0" />
									</linearGradient>
								</defs>
								<line x1="0" y1="20" x2="360" y2="20" stroke="#c9a84c" stroke-opacity="0.05" />
								<line x1="0" y1="40" x2="360" y2="40" stroke="#c9a84c" stroke-opacity="0.05" />
								<line x1="0" y1="60" x2="360" y2="60" stroke="#c9a84c" stroke-opacity="0.05" />
								<path
									d="M 0 64 L 30 56 L 60 60 L 90 48 L 120 42 L 150 52 L 180 38 L 210 28 L 240 32 L 270 22 L 300 18 L 330 14 L 360 10 L 360 80 L 0 80 Z"
									fill="url(#loginFillGrad)"
								/>
								<path
									d="M 0 64 L 30 56 L 60 60 L 90 48 L 120 42 L 150 52 L 180 38 L 210 28 L 240 32 L 270 22 L 300 18 L 330 14 L 360 10"
									stroke="url(#loginLineGrad)"
									stroke-width="1.8"
									fill="none"
									stroke-linecap="round"
								/>
								<circle cx="360" cy="10" r="3" fill="#c9a84c" />
								<circle cx="360" cy="10" r="6" fill="#c9a84c" fill-opacity="0.25" />
							</svg>
						</div>
						<div class="card-trade">
							<div class="trade-row"><span class="symbol">EURUSD</span><span class="gain">+82.40</span></div>
							<div class="trade-row"><span class="symbol">GBPJPY</span><span class="loss">-18.20</span></div>
							<div class="trade-row"><span class="symbol">XAUUSD</span><span class="gain">+412.00</span></div>
							<div class="trade-row"><span class="symbol">US100</span><span class="gain">+156.30</span></div>
						</div>
					</div>

					<div class="stat-row">
						<div class="stat">
							<div class="num">150<span class="num-accent">+</span></div>
							<div class="lbl">Active IBs</div>
						</div>
						<div class="stat">
							<div class="num">10K<span class="num-accent">+</span></div>
							<div class="lbl">Trades synced</div>
						</div>
						<div class="stat">
							<div class="num">99.9<span class="num-accent">%</span></div>
							<div class="lbl">Uptime</div>
						</div>
						<div class="stat">
							<div class="num accent">24/7</div>
							<div class="lbl">MT5 sync</div>
						</div>
					</div>
				</div>
			</section>

			<!-- ─── RIGHT — FORM ─── -->
			<section class="form-col">
				<div class="form-card">
					<h2 class="title">เข้าสู่ระบบ</h2>
					<p class="sub">เข้าด้วยบัญชีที่ IB ของคุณอนุมัติแล้ว</p>

					{#if error || urlErrorMessage}
						<div class="error-box" role="alert">{error || urlErrorMessage}</div>
					{/if}

					<button
						class="btn-google"
						onclick={handleGoogleLogin}
						disabled={googleLoading}
						type="button"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
							<path
								fill="#4285F4"
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
							/>
							<path
								fill="#34A853"
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							/>
							<path
								fill="#FBBC05"
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							/>
							<path
								fill="#EA4335"
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							/>
						</svg>
						{googleLoading ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}
					</button>

					<div class="divider">สำหรับ Admin / IB</div>

					<form onsubmit={handleLogin}>
						<div class="field">
							<label for="email">อีเมล</label>
							<input
								id="email"
								type="email"
								bind:value={email}
								placeholder="email@example.com"
								autocomplete="email"
								required
							/>
						</div>
						<div class="field">
							<label for="password">รหัสผ่าน</label>
							<input
								id="password"
								type="password"
								bind:value={password}
								placeholder="••••••••"
								autocomplete="current-password"
								required
							/>
						</div>

						<button class="btn-submit" type="submit" disabled={loading}>
							{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
						</button>
					</form>
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.login-root {
		--c-canvas: #0a0a0a;
		--c-canvas-2: #131110;
		--c-ink: #f5f1e3;
		--c-ink-2: #fffaf0;
		--c-muted: #8a8578;
		--c-muted-2: #5a5648;
		--c-border: rgba(245, 241, 227, 0.08);
		--c-border-2: rgba(245, 241, 227, 0.14);
		--c-surface: #1a1815;
		--c-accent: #c9a84c;
		--c-success: #22c55e;
		--c-danger: #ef4444;
		--f-display: 'Iowan Old Style', 'Charter', 'Source Serif Pro', Georgia, serif;

		min-height: 100vh;
		min-height: 100dvh;
		background: var(--c-canvas);
		color: var(--c-ink);
		-webkit-font-smoothing: antialiased;
		display: flex;
		flex-direction: column;
	}

	/* Top bar */
	.topbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 22px 40px;
		font-size: 11px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--c-muted);
		font-weight: 500;
		flex-shrink: 0;
	}
	.brand {
		color: var(--c-ink-2);
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.brand-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c-accent);
	}
	.topbar-nav {
		display: flex;
		gap: 32px;
		align-items: center;
	}
	.topbar-nav a {
		color: var(--c-muted);
		text-decoration: none;
		transition: color 0.15s;
	}
	.topbar-nav a:hover {
		color: var(--c-accent);
	}

	/* Stage */
	.stage {
		flex: 1;
		background-image:
			radial-gradient(ellipse 50% 35% at 0% 0%, rgba(201, 168, 76, 0.12), transparent 60%),
			radial-gradient(ellipse 60% 40% at 100% 100%, rgba(201, 168, 76, 0.08), transparent 60%);
	}

	.grid {
		display: grid;
		grid-template-columns: 1.15fr 1fr;
		max-width: 1440px;
		margin: 0 auto;
		min-height: 100%;
		padding: 0 40px;
		gap: 64px;
	}

	/* ─── LEFT — STORY ─── */
	.story {
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 48px 0 64px;
		position: relative;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 12px;
		font-size: 11px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--c-accent);
		font-weight: 600;
		margin-bottom: 36px;
		padding: 6px 12px;
		border: 1px solid rgba(201, 168, 76, 0.25);
		border-radius: 999px;
		background: rgba(201, 168, 76, 0.06);
		width: fit-content;
	}
	.pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--c-success);
		animation: pulse 1.8s infinite;
	}
	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
		}
		70% {
			box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
		}
	}

	.display {
		font-family: var(--f-display);
		font-size: clamp(48px, 5.4vw, 76px);
		line-height: 1.02;
		letter-spacing: -0.02em;
		color: var(--c-ink-2);
		font-weight: 400;
		margin: 0 0 28px;
	}
	.display em {
		font-style: italic;
		color: var(--c-accent);
		font-weight: 500;
	}

	.lede {
		font-size: 16px;
		line-height: 1.6;
		color: var(--c-muted);
		max-width: 52ch;
		margin: 0 0 48px;
	}
	.lede strong {
		color: var(--c-ink);
		font-weight: 600;
	}

	.hero-frame {
		position: relative;
		margin: 0 0 56px;
		height: 240px;
	}
	.card-equity {
		position: absolute;
		top: 0;
		left: 0;
		width: 380px;
		max-width: 100%;
		background: linear-gradient(180deg, #1a1815 0%, #131110 100%);
		border: 1px solid var(--c-border-2);
		border-radius: 14px;
		padding: 18px 20px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
		transform: rotate(-1.5deg);
	}
	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}
	.ticker {
		font-weight: 600;
		color: var(--c-ink-2);
		font-size: 13px;
		letter-spacing: 0.04em;
	}
	.pnl {
		color: var(--c-success);
		font-size: 13px;
		font-weight: 700;
		background: rgba(34, 197, 94, 0.12);
		padding: 3px 10px;
		border-radius: 999px;
	}
	.card-equity svg {
		width: 100%;
		display: block;
	}

	.card-trade {
		position: absolute;
		top: 100px;
		left: 320px;
		width: 240px;
		background: linear-gradient(180deg, #1a1815 0%, #131110 100%);
		border: 1px solid var(--c-border-2);
		border-radius: 14px;
		padding: 14px 16px;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
		transform: rotate(2deg);
	}
	.trade-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid var(--c-border);
		font-size: 12px;
	}
	.trade-row:last-child {
		border-bottom: 0;
	}
	.symbol {
		font-weight: 600;
		color: var(--c-ink);
	}
	.gain {
		color: var(--c-success);
		font-weight: 600;
	}
	.loss {
		color: var(--c-danger);
		font-weight: 600;
	}

	.stat-row {
		display: grid;
		grid-template-columns: repeat(4, auto);
		gap: 56px;
		padding-top: 32px;
		border-top: 1px solid var(--c-border);
	}
	.stat .num {
		font-family: var(--f-display);
		font-size: 40px;
		line-height: 1;
		color: var(--c-ink-2);
		font-weight: 400;
		letter-spacing: -0.02em;
	}
	.stat .num.accent {
		color: var(--c-accent);
		font-style: italic;
	}
	.num-accent {
		color: var(--c-accent);
	}
	.stat .lbl {
		margin-top: 6px;
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--c-muted-2);
	}

	/* ─── RIGHT — FORM ─── */
	.form-col {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 0;
	}
	.form-card {
		width: 100%;
		max-width: 420px;
		background: rgba(20, 19, 17, 0.8);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--c-border-2);
		border-radius: 20px;
		padding: 36px 32px;
	}
	.form-card .title {
		font-family: var(--f-display);
		font-size: 28px;
		color: var(--c-ink-2);
		margin: 0 0 6px;
		letter-spacing: -0.01em;
		font-weight: 500;
	}
	.form-card .sub {
		color: var(--c-muted);
		font-size: 14px;
		margin: 0 0 24px;
	}

	.error-box {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		color: #fca5a5;
		font-size: 13px;
		padding: 10px 14px;
		border-radius: 10px;
		margin-bottom: 16px;
	}

	.btn-google {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		background: #ffffff;
		color: #1a1815;
		border: 0;
		padding: 13px 18px;
		border-radius: 12px;
		font-weight: 600;
		font-size: 14.5px;
		cursor: pointer;
		font-family: inherit;
		transition: transform 0.1s, box-shadow 0.2s, opacity 0.2s;
	}
	.btn-google:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 20px rgba(255, 255, 255, 0.1);
	}
	.btn-google:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--c-muted-2);
		font-size: 11px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		padding: 22px 0;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--c-border);
	}

	.field {
		margin-bottom: 14px;
	}
	.field label {
		display: block;
		font-size: 11.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--c-muted);
		margin-bottom: 8px;
		font-weight: 600;
	}
	.field input {
		width: 100%;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--c-border-2);
		color: var(--c-ink);
		padding: 12px 14px;
		border-radius: 10px;
		font-size: 14px;
		font-family: inherit;
		transition: border-color 0.2s, background 0.2s;
	}
	.field input:focus {
		outline: none;
		border-color: var(--c-accent);
		background: rgba(201, 168, 76, 0.04);
	}
	.field input::placeholder {
		color: var(--c-muted-2);
	}

	.btn-submit {
		width: 100%;
		background: var(--c-accent);
		color: #1a1815;
		border: 0;
		padding: 14px 18px;
		border-radius: 12px;
		font-weight: 700;
		font-size: 14.5px;
		cursor: pointer;
		font-family: inherit;
		margin-top: 8px;
		box-shadow: 0 8px 20px rgba(201, 168, 76, 0.18);
		transition: transform 0.1s, opacity 0.2s;
	}
	.btn-submit:hover:not(:disabled) {
		transform: translateY(-1px);
	}
	.btn-submit:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* ─── Mobile fallback — hide story column, center form ─── */
	@media (max-width: 900px) {
		.topbar {
			padding: 16px 20px;
		}
		.grid {
			grid-template-columns: 1fr;
			padding: 0 20px;
			gap: 0;
		}
		.story {
			display: none;
		}
		.form-col {
			padding: 24px 0 48px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
		.btn-google,
		.btn-submit {
			transition: none;
		}
	}
</style>
