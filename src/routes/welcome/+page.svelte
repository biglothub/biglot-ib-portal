<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase';
	import { isMobile } from '$lib/pwa/platform';

	const SEEN_KEY = 'pwa.welcome.seen';
	const FRAMES = 3;

	let current = $state(0);
	let googleLoading = $state(false);
	let error = $state('');

	onMount(() => {
		if (!isMobile()) {
			goto('/auth/login', { replaceState: true });
			return;
		}
		if (browser && localStorage.getItem(SEEN_KEY) === '1') {
			goto('/auth/login', { replaceState: true });
		}
	});

	function markSeen() {
		if (browser) localStorage.setItem(SEEN_KEY, '1');
	}

	function next() {
		if (current < FRAMES - 1) current += 1;
	}

	function skip() {
		markSeen();
		goto('/auth/login', { replaceState: true });
	}

	function goToFrame(i: number) {
		current = i;
	}

	async function handleGoogleLogin() {
		googleLoading = true;
		error = '';
		markSeen();

		const { error: oauthError } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${window.location.origin}/auth/callback` }
		});

		if (oauthError) {
			error = 'ไม่สามารถเชื่อมต่อ Google ได้ กรุณาลองใหม่';
			googleLoading = false;
		}
	}

	function continueWithEmail() {
		markSeen();
		goto('/auth/login');
	}

	let touchStartX = 0;
	function onTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
	}
	function onTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		if (Math.abs(dx) < 50) return;
		if (dx < 0 && current < FRAMES - 1) current += 1;
		if (dx > 0 && current > 0) current -= 1;
	}
</script>

<svelte:head>
	<title>ยินดีต้อนรับ · IB Portal</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<div class="welcome-root md:hidden">
	<div
		class="track"
		role="region"
		aria-label="หน้าจอแนะนำการใช้งาน"
		aria-roledescription="carousel"
		style="transform: translateX(-{current * 100}%)"
		ontouchstart={onTouchStart}
		ontouchend={onTouchEnd}
	>
		<!-- Frame 1 — Splash -->
		<section class="frame">
			<header class="head">
				<span class="brand-mark"><span class="dot"></span>IB PORTAL</span>
				<button class="skip" onclick={skip}>ข้าม</button>
			</header>

			<div class="hero">
				<svg viewBox="0 0 240 240" fill="none" aria-hidden="true">
					<defs>
						<linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0%" stop-color="#e8c84d" />
							<stop offset="100%" stop-color="#8b7635" />
						</linearGradient>
						<linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
							<stop offset="0%" stop-color="#c9a84c" stop-opacity="0" />
							<stop offset="50%" stop-color="#c9a84c" />
							<stop offset="100%" stop-color="#c9a84c" stop-opacity="0" />
						</linearGradient>
					</defs>
					<circle cx="120" cy="120" r="92" stroke="url(#goldGrad)" stroke-width="1.5" stroke-opacity="0.4" />
					<circle cx="120" cy="120" r="72" stroke="#c9a84c" stroke-width="1" stroke-opacity="0.18" />
					<rect x="48" y="68" width="144" height="104" rx="14" fill="#1a1815" stroke="#c9a84c" stroke-opacity="0.3" />
					<line x1="60" y1="100" x2="180" y2="100" stroke="#c9a84c" stroke-opacity="0.06" />
					<line x1="60" y1="125" x2="180" y2="125" stroke="#c9a84c" stroke-opacity="0.06" />
					<line x1="60" y1="150" x2="180" y2="150" stroke="#c9a84c" stroke-opacity="0.06" />
					<path d="M 60 152 L 78 138 L 96 142 L 114 122 L 132 112 L 150 96 L 168 88 L 180 80" stroke="url(#lineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
					<circle cx="180" cy="80" r="4" fill="#c9a84c" />
					<circle cx="180" cy="80" r="8" fill="#c9a84c" fill-opacity="0.25" />
					<rect x="60" y="78" width="40" height="6" rx="3" fill="#c9a84c" />
					<rect x="60" y="88" width="64" height="3" rx="1.5" fill="#8a8578" fill-opacity="0.5" />
					<rect x="148" y="78" width="36" height="14" rx="7" fill="#22c55e" fill-opacity="0.18" />
					<text x="166" y="88" font-size="8" fill="#22c55e" text-anchor="middle" font-weight="700">+12.4%</text>
					<rect x="32" y="190" width="58" height="22" rx="11" fill="#1a1815" stroke="#c9a84c" stroke-opacity="0.25" />
					<circle cx="44" cy="201" r="3" fill="#22c55e" />
					<text x="74" y="205" font-size="9" fill="#f5f1e3" text-anchor="middle" font-weight="600">เชื่อมต่อ</text>
					<rect x="150" y="190" width="58" height="22" rx="11" fill="#1a1815" stroke="#c9a84c" stroke-opacity="0.25" />
					<text x="179" y="205" font-size="9" fill="#c9a84c" text-anchor="middle" font-weight="600">MT5 Live</text>
				</svg>
			</div>

			<div class="copy">
				<div class="stat-chip"><span class="pulse"></span>Real-time MT5</div>
				<h2>พอร์ตของคุณ<br />อยู่ในมือคุณเสมอ</h2>
				<p>เห็นทุก trade ตั้งแต่เปิดออร์เดอร์จนปิดดีล พร้อม journal และ AI coach ที่เรียนรู้สไตล์การเทรดของคุณ</p>
			</div>
		</section>

		<!-- Frame 2 — Value props -->
		<section class="frame">
			<header class="head">
				<span class="brand-mark"><span class="dot"></span>IB PORTAL</span>
				<button class="skip" onclick={skip}>ข้าม</button>
			</header>

			<div class="copy" style="padding-top: 16px;">
				<h2>3 อย่างที่<br />คุณจะได้กลับไป</h2>
				<p>คุณจะมีเวลามากขึ้นเพื่อเทรด — ไม่ต้องมาอัปเดต spreadsheet เอง</p>
			</div>

			<div class="value-list">
				<div class="value-row">
					<div class="ico" aria-hidden="true">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
						</svg>
					</div>
					<div class="vc">
						<h3>ซิงก์ MT5 อัตโนมัติ</h3>
						<p>ทุก trade เข้าระบบทันทีที่ปิดดีล — ไม่ต้อง import เอง</p>
					</div>
				</div>

				<div class="value-row">
					<div class="ico" aria-hidden="true">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M14 9V5a3 3 0 0 0-6 0v4" />
							<rect x="2" y="9" width="20" height="12" rx="2" />
							<circle cx="12" cy="15" r="2" />
						</svg>
					</div>
					<div class="vc">
						<h3>Journal + AI Coach</h3>
						<p>บันทึก trade · วิเคราะห์รูปแบบ · รับ insight ที่ตรงกับสไตล์คุณ</p>
					</div>
				</div>

				<div class="value-row">
					<div class="ico" aria-hidden="true">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
							<path d="M13.73 21a2 2 0 0 1-3.46 0" />
						</svg>
					</div>
					<div class="vc">
						<h3>แจ้งเตือนเมื่อสำคัญจริง</h3>
						<p>Risk threshold · Daily journal reminder · ไม่มี spam</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Frame 3 — Sign-in -->
		<section class="frame">
			<header class="head">
				<span class="brand-mark"><span class="dot"></span>IB PORTAL</span>
				<button class="skip" onclick={skip}>ช่วยเหลือ</button>
			</header>

			<div class="copy" style="padding: 24px 0 8px;">
				<h2>เริ่มเทรดอย่าง<br />เป็นระบบ</h2>
				<p>เข้าสู่ระบบด้วยบัญชีที่ IB ของคุณอนุมัติแล้ว ใช้งานข้ามอุปกรณ์ได้ทันที</p>
			</div>

			{#if error}
				<div class="error-box" role="alert">{error}</div>
			{/if}

			<div class="signin-options">
				<button class="opt primary" onclick={handleGoogleLogin} disabled={googleLoading}>
					<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4" />
						<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853" />
						<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fbbc04" />
						<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335" />
					</svg>
					<span>{googleLoading ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}</span>
				</button>

				<div class="opt-divider">หรือ</div>

				<button class="opt" onclick={continueWithEmail}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<rect x="3" y="5" width="18" height="14" rx="2" />
						<path d="m3 7 9 6 9-6" />
					</svg>
					<span>เข้าสู่ระบบด้วยอีเมล</span>
				</button>
			</div>

			<div class="terms">
				การดำเนินการต่อ ถือว่าคุณยอมรับ<br />
				<a href="/legal/terms">เงื่อนไขการใช้งาน</a> และ
				<a href="/legal/privacy">นโยบายความเป็นส่วนตัว</a> ของ IB Portal
			</div>
		</section>
	</div>

	<!-- Footer: pager + CTA (CTA hidden on Frame 3 since options act as CTA) -->
	<footer class="foot">
		<div class="pager" role="tablist" aria-label="หน้าจอแนะนำ">
			{#each Array(FRAMES) as _, i}
				<button
					type="button"
					role="tab"
					aria-selected={current === i}
					aria-label={`ไปยังหน้าที่ ${i + 1}`}
					class="dot"
					class:active={current === i}
					onclick={() => goToFrame(i)}
				></button>
			{/each}
		</div>

		{#if current < FRAMES - 1}
			<button class="cta" onclick={next}>
				{current === 0 ? 'เริ่มต้นใช้งาน' : 'ถัดไป'}
			</button>
		{/if}
	</footer>
</div>

<style>
	.welcome-root {
		min-height: 100dvh;
		min-height: 100vh;
		background: #0a0a0a;
		color: #f5f1e3;
		font-family:
			-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Thai', 'IBM Plex Sans Thai',
			Inter, sans-serif;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
		background-image:
			radial-gradient(ellipse 70% 50% at 50% -10%, rgba(201, 168, 76, 0.18), transparent 70%),
			radial-gradient(ellipse 80% 60% at 50% 110%, rgba(201, 168, 76, 0.06), transparent 70%);
		padding-top: env(safe-area-inset-top);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.track {
		flex: 1;
		display: flex;
		width: 100%;
		min-height: 0;
		transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
		will-change: transform;
	}

	.frame {
		flex: 0 0 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		padding: 16px 24px 12px;
		min-height: 0;
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 28px;
	}
	.brand-mark {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		color: #c9a84c;
		letter-spacing: 0.06em;
	}
	.brand-mark .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #c9a84c;
	}
	.skip {
		font-size: 13px;
		color: #8a8578;
		background: transparent;
		border: 0;
		padding: 8px;
		margin: -8px;
		cursor: pointer;
		font-family: inherit;
	}
	.skip:active {
		color: #c9a84c;
	}

	.hero {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px 0;
		min-height: 0;
	}
	.hero svg {
		width: min(240px, 60vw);
		height: auto;
	}

	.copy {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 8px 2px 4px;
	}
	.copy h2 {
		font-size: 26px;
		line-height: 1.2;
		margin: 0;
		letter-spacing: -0.005em;
		font-weight: 700;
		color: #ffffff;
	}
	.copy p {
		color: #8a8578;
		margin: 0;
		font-size: 14.5px;
		line-height: 1.55;
	}

	.stat-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(201, 168, 76, 0.1);
		color: #c9a84c;
		border: 1px solid rgba(201, 168, 76, 0.2);
		padding: 5px 10px;
		border-radius: 999px;
		font-size: 11.5px;
		font-weight: 600;
		width: fit-content;
	}
	.stat-chip .pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22c55e;
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

	.value-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 0 12px;
	}
	.value-row {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		padding: 14px;
		background: #1a1815;
		border: 1px solid rgba(245, 241, 227, 0.08);
		border-radius: 16px;
	}
	.value-row .ico {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: rgba(201, 168, 76, 0.12);
		color: #c9a84c;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.value-row .vc h3 {
		margin: 0 0 4px;
		font-size: 15px;
		font-weight: 600;
		color: #ffffff;
		letter-spacing: -0.005em;
	}
	.value-row .vc p {
		margin: 0;
		color: #8a8578;
		font-size: 13px;
		line-height: 1.5;
	}

	.signin-options {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 16px;
	}
	.opt {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 16px 18px;
		min-height: 52px;
		border: 1px solid rgba(245, 241, 227, 0.08);
		background: #1a1815;
		border-radius: 14px;
		font-weight: 500;
		font-size: 14.5px;
		color: #f5f1e3;
		font-family: inherit;
		cursor: pointer;
		transition: transform 0.1s ease;
	}
	.opt:active {
		transform: scale(0.98);
	}
	.opt:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.opt.primary {
		background: #ffffff;
		color: #1a1815;
		border-color: #ffffff;
		font-weight: 600;
	}
	.opt-divider {
		display: flex;
		align-items: center;
		gap: 12px;
		color: #8a8578;
		font-size: 11.5px;
		padding: 6px 0;
	}
	.opt-divider::before,
	.opt-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(245, 241, 227, 0.08);
	}

	.error-box {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		color: #fca5a5;
		font-size: 13px;
		padding: 10px 14px;
		border-radius: 12px;
		margin-top: 12px;
	}

	.terms {
		font-size: 11px;
		color: #8a8578;
		text-align: center;
		padding: 16px 8px 0;
		line-height: 1.55;
	}
	.terms a {
		color: #c9a84c;
		text-decoration: none;
		font-weight: 500;
	}

	.foot {
		flex-shrink: 0;
		padding: 8px 24px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.pager {
		display: flex;
		justify-content: center;
		gap: 6px;
		padding: 6px 0;
	}
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(245, 241, 227, 0.16);
		border: 0;
		padding: 0;
		cursor: pointer;
		transition:
			width 0.2s ease,
			background 0.2s ease;
	}
	.dot.active {
		width: 24px;
		background: #c9a84c;
		border-radius: 999px;
	}

	.cta {
		background: #c9a84c;
		color: #1a1815;
		padding: 16px 22px;
		min-height: 52px;
		border-radius: 999px;
		text-align: center;
		font-weight: 700;
		font-size: 15px;
		letter-spacing: 0.01em;
		box-shadow: 0 8px 20px rgba(201, 168, 76, 0.22);
		border: 0;
		font-family: inherit;
		cursor: pointer;
		transition: transform 0.1s ease;
	}
	.cta:active {
		transform: scale(0.98);
	}

	@media (prefers-reduced-motion: reduce) {
		.track,
		.cta,
		.opt,
		.dot {
			transition: none;
		}
		.stat-chip .pulse {
			animation: none;
		}
	}
</style>
