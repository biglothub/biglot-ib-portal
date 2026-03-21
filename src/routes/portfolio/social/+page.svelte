<script lang="ts">
	import { formatCurrency, formatPercent, formatNumber, timeAgo } from '$lib/utils';
	import type { SocialPost } from '../../api/portfolio/social/+server';
	import type { LeaderboardEntry } from '../../api/portfolio/social/leaderboard/+server';
	import type { SocialSettings } from '../../api/portfolio/social/settings/+server';

	let { data } = $props();

	// ─── State ────────────────────────────────────────────────────────────────
	type Tab = 'feed' | 'leaderboard';
	type LeaderboardSort = 'net_pnl' | 'win_rate' | 'profit_factor';
	type PostType = 'insight' | 'trade_share' | 'milestone';

	let activeTab = $state<Tab>('feed');
	let leaderboardSort = $state<LeaderboardSort>('net_pnl');

	// Feed state
	let posts = $state<SocialPost[]>(data.initialPosts);
	let loadingMore = $state(false);
	let hasMore = $state(data.initialPosts.length === 20);

	// Settings state
	let mySettings = $state<SocialSettings | null>(data.mySettings);
	let showSettingsForm = $state(!data.mySettings?.is_public);
	let settingsForm = $state({
		display_name: data.mySettings?.display_name ?? '',
		bio: data.mySettings?.bio ?? '',
		is_public: data.mySettings?.is_public ?? false,
		client_account_id: data.mySettings?.client_account_id ?? ''
	});
	let savingSettings = $state(false);
	let settingsError = $state('');
	let settingsSaved = $state(false);

	// Create post state
	let showCreateForm = $state(false);
	let newPostContent = $state('');
	let newPostType = $state<PostType>('insight');
	let submittingPost = $state(false);
	let postError = $state('');

	// Comments state — per post
	let expandedComments = $state<Record<string, boolean>>({});
	let commentsCache = $state<Record<string, { list: Array<{id: string; user_id: string; display_name: string; avatar_url: string | null; content: string; created_at: string}>; loading: boolean }>>({});
	let newCommentText = $state<Record<string, string>>({});
	let submittingComment = $state<Record<string, boolean>>({});

	// Leaderboard state
	let leaderboard = $state<LeaderboardEntry[]>(data.leaderboard);

	// ─── Derived ──────────────────────────────────────────────────────────────
	const isOptedIn = $derived(mySettings?.is_public === true);

	const sortedLeaderboard = $derived.by(() => {
		return [...leaderboard].sort((a, b) => {
			if (leaderboardSort === 'net_pnl') return b.net_pnl - a.net_pnl;
			if (leaderboardSort === 'win_rate') return b.win_rate - a.win_rate;
			return b.profit_factor - a.profit_factor;
		});
	});

	const postTypeLabel: Record<PostType, string> = {
		insight: 'ข้อคิดเห็น',
		trade_share: 'แชร์เทรด',
		milestone: 'ไมล์สโตน'
	};

	const postTypeBadgeClass: Record<string, string> = {
		insight: 'bg-blue-500/20 text-blue-400',
		trade_share: 'bg-green-500/20 text-green-400',
		milestone: 'bg-amber-500/20 text-amber-400'
	};

	// ─── Helpers ──────────────────────────────────────────────────────────────
	function avatarInitials(name: string): string {
		return name
			.split(' ')
			.slice(0, 2)
			.map((w) => w[0] ?? '')
			.join('')
			.toUpperCase() || '?';
	}

	function avatarColor(userId: string): string {
		const colors = [
			'bg-blue-500', 'bg-green-500', 'bg-purple-500',
			'bg-pink-500', 'bg-amber-500', 'bg-cyan-500', 'bg-red-500'
		];
		let hash = 0;
		for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) | 0;
		return colors[Math.abs(hash) % colors.length];
	}

	function pnlColor(v: number) {
		return v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
	}

	function rankMedal(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return `#${rank}`;
	}

	// ─── Actions ──────────────────────────────────────────────────────────────
	async function saveSettings() {
		savingSettings = true;
		settingsError = '';
		settingsSaved = false;
		try {
			const res = await fetch('/api/portfolio/social/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					display_name: settingsForm.display_name,
					bio: settingsForm.bio,
					is_public: settingsForm.is_public,
					client_account_id: settingsForm.client_account_id || null
				})
			});
			const body = await res.json();
			if (!res.ok) {
				settingsError = body.message ?? 'เกิดข้อผิดพลาด';
				return;
			}
			mySettings = body.settings as SocialSettings;
			settingsSaved = true;
			if (mySettings.is_public) {
				showSettingsForm = false;
			}
		} catch {
			settingsError = 'ไม่สามารถเชื่อมต่อได้';
		} finally {
			savingSettings = false;
		}
	}

	async function createPost() {
		if (!newPostContent.trim()) return;
		submittingPost = true;
		postError = '';
		try {
			const res = await fetch('/api/portfolio/social', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ post_type: newPostType, content: newPostContent })
			});
			const body = await res.json();
			if (!res.ok) {
				postError = body.message ?? 'เกิดข้อผิดพลาด';
				return;
			}
			posts = [body.post as SocialPost, ...posts];
			newPostContent = '';
			showCreateForm = false;
		} catch {
			postError = 'ไม่สามารถเชื่อมต่อได้';
		} finally {
			submittingPost = false;
		}
	}

	async function toggleLike(post: SocialPost) {
		// Optimistic update
		posts = posts.map((p) =>
			p.id === post.id
				? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.liked_by_me ? p.likes_count - 1 : p.likes_count + 1 }
				: p
		);
		try {
			await fetch(`/api/portfolio/social/${post.id}/like`, { method: 'POST' });
		} catch {
			// Revert on failure
			posts = posts.map((p) =>
				p.id === post.id
					? { ...p, liked_by_me: post.liked_by_me, likes_count: post.likes_count }
					: p
			);
		}
	}

	async function deletePost(postId: string) {
		const res = await fetch(`/api/portfolio/social?id=${postId}`, { method: 'DELETE' });
		if (res.ok) {
			posts = posts.filter((p) => p.id !== postId);
		}
	}

	async function loadComments(postId: string) {
		if (commentsCache[postId]) {
			expandedComments = { ...expandedComments, [postId]: !expandedComments[postId] };
			return;
		}
		commentsCache = { ...commentsCache, [postId]: { list: [], loading: true } };
		expandedComments = { ...expandedComments, [postId]: true };
		try {
			const res = await fetch(`/api/portfolio/social/${postId}/comments`);
			const body = await res.json();
			commentsCache = { ...commentsCache, [postId]: { list: body.comments ?? [], loading: false } };
		} catch {
			commentsCache = { ...commentsCache, [postId]: { list: [], loading: false } };
		}
	}

	async function submitComment(postId: string) {
		const text = newCommentText[postId] ?? '';
		if (!text.trim()) return;
		submittingComment = { ...submittingComment, [postId]: true };
		try {
			const res = await fetch(`/api/portfolio/social/${postId}/comments`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: text })
			});
			const body = await res.json();
			if (res.ok) {
				commentsCache = {
					...commentsCache,
					[postId]: {
						list: [...(commentsCache[postId]?.list ?? []), body.comment],
						loading: false
					}
				};
				posts = posts.map((p) =>
					p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
				);
				newCommentText = { ...newCommentText, [postId]: '' };
			}
		} finally {
			submittingComment = { ...submittingComment, [postId]: false };
		}
	}

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		try {
			const cursor = posts.at(-1)?.created_at;
			const res = await fetch(`/api/portfolio/social?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
			const body = await res.json();
			const newPosts: SocialPost[] = body.posts ?? [];
			posts = [...posts, ...newPosts];
			hasMore = newPosts.length === 20;
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>สังคมเทรดเดอร์ — IB Portal</title>
</svelte:head>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
		<div>
			<h2 class="text-lg font-semibold text-white">สังคมเทรดเดอร์</h2>
			<p class="text-sm text-gray-500">แบ่งปันประสบการณ์และเรียนรู้จากชุมชน (opt-in)</p>
		</div>
		<!-- Tab pills -->
		<div class="flex items-center gap-1 bg-dark-surface border border-dark-border rounded-lg p-1 self-start sm:self-auto">
			<button
				onclick={() => activeTab = 'feed'}
				class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors
					{activeTab === 'feed' ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-white'}"
				aria-label="ฟีด"
			>ฟีด</button>
			<button
				onclick={() => activeTab = 'leaderboard'}
				class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors
					{activeTab === 'leaderboard' ? 'bg-brand-primary text-white' : 'text-gray-400 hover:text-white'}"
				aria-label="ลีดเดอร์บอร์ด"
			>ลีดเดอร์บอร์ด</button>
		</div>
	</div>

	<!-- ════════════════ FEED TAB ════════════════ -->
	{#if activeTab === 'feed'}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<!-- Left: Feed -->
			<div class="lg:col-span-2 space-y-4">

				<!-- Opt-in / settings banner -->
				{#if !isOptedIn || showSettingsForm}
					<div class="card">
						{#if !isOptedIn}
							<div class="flex items-start gap-3 mb-4">
								<div class="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
									<svg class="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								</div>
								<div>
									<h3 class="font-semibold text-white">เข้าร่วมชุมชนเทรดเดอร์</h3>
									<p class="text-sm text-gray-400 mt-0.5">แบ่งปันข้อมูลเชิงลึก เรียนรู้จากผู้อื่น และปรากฏบนลีดเดอร์บอร์ด</p>
								</div>
							</div>
						{:else}
							<div class="flex items-center justify-between mb-4">
								<h3 class="font-semibold text-white">ตั้งค่าโปรไฟล์สังคม</h3>
								<button onclick={() => showSettingsForm = false} class="text-gray-500 hover:text-gray-300 transition-colors" aria-label="ปิด">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
								</button>
							</div>
						{/if}

						<div class="space-y-3">
							<div>
								<label class="block text-xs font-medium text-gray-400 mb-1" for="social-display-name">ชื่อแสดง <span class="text-red-400">*</span></label>
								<input
									id="social-display-name"
									type="text"
									bind:value={settingsForm.display_name}
									placeholder="เช่น TraderJoe88"
									maxlength="50"
									class="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-primary focus:outline-none"
								/>
							</div>
							<div>
								<label class="block text-xs font-medium text-gray-400 mb-1" for="social-bio">คำอธิบายสั้น ๆ</label>
								<input
									id="social-bio"
									type="text"
									bind:value={settingsForm.bio}
									placeholder="เช่น เทรด XAUUSD, Scalper"
									maxlength="100"
									class="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-brand-primary focus:outline-none"
								/>
							</div>
							{#if data.myAccounts.length > 0}
								<div>
									<label class="block text-xs font-medium text-gray-400 mb-1" for="social-account">บัญชีสำหรับลีดเดอร์บอร์ด</label>
									<select
										id="social-account"
										bind:value={settingsForm.client_account_id}
										class="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white focus:border-brand-primary focus:outline-none"
									>
										<option value="">— ไม่ระบุ —</option>
										{#each data.myAccounts as acc}
											<option value={acc.id}>{acc.mt5_account_id} @ {acc.mt5_server}</option>
										{/each}
									</select>
								</div>
							{/if}
							<label class="flex items-center gap-2.5 cursor-pointer select-none">
								<input
									type="checkbox"
									bind:checked={settingsForm.is_public}
									class="w-4 h-4 rounded border-dark-border bg-dark-bg accent-brand-primary"
								/>
								<span class="text-sm text-gray-300">แสดงโปรไฟล์และสถิติบนลีดเดอร์บอร์ด</span>
							</label>
							{#if settingsError}
								<p class="text-xs text-red-400">{settingsError}</p>
							{/if}
							{#if settingsSaved}
								<p class="text-xs text-green-400">บันทึกเรียบร้อยแล้ว</p>
							{/if}
							<button
								onclick={saveSettings}
								disabled={savingSettings || !settingsForm.display_name.trim()}
								class="w-full rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
							>
								{savingSettings ? 'กำลังบันทึก...' : 'บันทึกและเข้าร่วม'}
							</button>
						</div>
					</div>
				{/if}

				<!-- Create post button / form (only for opted-in users) -->
				{#if isOptedIn && !showSettingsForm}
					{#if !showCreateForm}
						<div class="flex items-center gap-3">
							<button
								onclick={() => showCreateForm = true}
								class="flex-1 text-left rounded-xl border border-dark-border bg-dark-surface px-4 py-3 text-sm text-gray-500 hover:border-brand-primary/40 hover:text-gray-300 transition-colors"
							>
								แบ่งปันข้อคิดเห็น หรือบันทึกเทรดของคุณ...
							</button>
							<button
								onclick={() => showSettingsForm = true}
								class="p-2.5 rounded-lg border border-dark-border text-gray-500 hover:text-gray-300 hover:border-brand-primary/40 transition-colors"
								aria-label="ตั้งค่าโปรไฟล์"
								title="ตั้งค่าโปรไฟล์"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</button>
						</div>
					{:else}
						<div class="card space-y-3">
							<div class="flex items-center justify-between">
								<h3 class="text-sm font-semibold text-white">สร้างโพสต์ใหม่</h3>
								<button onclick={() => { showCreateForm = false; postError = ''; }} class="text-gray-500 hover:text-gray-300 transition-colors" aria-label="ปิด">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
								</button>
							</div>

							<!-- Post type selector -->
							<div class="flex gap-2" role="group" aria-label="ประเภทโพสต์">
								{#each (['insight', 'trade_share', 'milestone'] as PostType[]) as pt}
									<button
										onclick={() => newPostType = pt}
										class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
											{newPostType === pt
												? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
												: 'border-dark-border text-gray-500 hover:text-gray-300'}"
									>
										{postTypeLabel[pt]}
									</button>
								{/each}
							</div>

							<textarea
								bind:value={newPostContent}
								placeholder="เขียนข้อความที่นี่..."
								maxlength="500"
								rows="4"
								class="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-primary focus:outline-none resize-none"
							></textarea>

							<div class="flex items-center justify-between">
								<span class="text-xs text-gray-600">{newPostContent.length}/500</span>
								<div class="flex items-center gap-2">
									{#if postError}
										<span class="text-xs text-red-400">{postError}</span>
									{/if}
									<button
										onclick={createPost}
										disabled={submittingPost || !newPostContent.trim()}
										class="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
									>
										{submittingPost ? 'กำลังโพสต์...' : 'โพสต์'}
									</button>
								</div>
							</div>
						</div>
					{/if}
				{/if}

				<!-- Feed -->
				{#if posts.length === 0}
					<div class="card flex flex-col items-center justify-center py-16 text-center">
						<div class="w-14 h-14 rounded-2xl bg-brand-primary/10 flex items-center justify-center mb-4">
							<svg class="w-7 h-7 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
							</svg>
						</div>
						<h3 class="font-semibold text-white mb-1">ยังไม่มีโพสต์</h3>
						<p class="text-sm text-gray-500 max-w-xs">เมื่อเทรดเดอร์เข้าร่วมชุมชน โพสต์จะปรากฏที่นี่</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each posts as post (post.id)}
							{@const cmts = commentsCache[post.id]}
							<article class="card space-y-3">
								<!-- Post header -->
								<div class="flex items-start justify-between gap-3">
									<div class="flex items-center gap-3 min-w-0">
										{#if post.avatar_url}
											<img src={post.avatar_url} alt={post.display_name} class="w-9 h-9 rounded-full shrink-0 object-cover" />
										{:else}
											<div class="w-9 h-9 rounded-full {avatarColor(post.user_id)} flex items-center justify-center text-xs font-bold text-white shrink-0">
												{avatarInitials(post.display_name)}
											</div>
										{/if}
										<div class="min-w-0">
											<div class="flex items-center gap-2 flex-wrap">
												<span class="text-sm font-semibold text-white truncate">{post.display_name}</span>
												<span class="px-1.5 py-0.5 rounded text-xs font-medium {postTypeBadgeClass[post.post_type] ?? 'bg-gray-500/20 text-gray-400'}">
													{postTypeLabel[post.post_type as PostType] ?? post.post_type}
												</span>
											</div>
											<time class="text-xs text-gray-500" datetime={post.created_at}>{timeAgo(post.created_at)}</time>
										</div>
									</div>

									<!-- Delete own post -->
									<!-- Note: we can't check user_id client-side without passing userId from server -->
									<!-- We'll show delete based on matching display_name with mySettings (best effort) -->
									{#if mySettings?.display_name && post.display_name === mySettings.display_name}
										<button
											onclick={() => deletePost(post.id)}
											class="text-gray-600 hover:text-red-400 transition-colors shrink-0"
											aria-label="ลบโพสต์"
											title="ลบโพสต์"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									{/if}
								</div>

								<!-- Content -->
								<p class="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>

								<!-- Trade snapshot (trade_share type) -->
								{#if post.post_type === 'trade_share' && post.trade_symbol}
									<div class="rounded-lg border border-dark-border bg-dark-bg px-3 py-2.5 flex items-center justify-between gap-4">
										<div class="flex items-center gap-2">
											<span class="text-sm font-semibold text-white">{post.trade_symbol}</span>
											{#if post.trade_side}
												<span class="px-1.5 py-0.5 rounded text-xs font-medium
													{post.trade_side.toUpperCase() === 'BUY'
														? 'bg-green-500/20 text-green-400'
														: 'bg-red-500/20 text-red-400'}">
													{post.trade_side.toUpperCase()}
												</span>
											{/if}
										</div>
										{#if post.trade_profit !== null}
											<span class="text-sm font-bold {pnlColor(post.trade_profit)}">
												{post.trade_profit >= 0 ? '+' : ''}{formatCurrency(post.trade_profit)}
											</span>
										{/if}
									</div>
								{/if}

								<!-- Actions -->
								<div class="flex items-center gap-4 pt-1 border-t border-dark-border/50">
									<button
										onclick={() => toggleLike(post)}
										class="flex items-center gap-1.5 text-sm transition-colors
											{post.liked_by_me ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}"
										aria-label="{post.liked_by_me ? 'ถอนไลก์' : 'ไลก์'}"
									>
										<svg class="w-4 h-4" fill="{post.liked_by_me ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
										</svg>
										<span>{formatNumber(post.likes_count)}</span>
									</button>
									<button
										onclick={() => loadComments(post.id)}
										class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-400 transition-colors"
										aria-label="ความคิดเห็น"
										aria-expanded={expandedComments[post.id] ?? false}
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
										</svg>
										<span>{formatNumber(post.comments_count)}</span>
									</button>
								</div>

								<!-- Comments section -->
								{#if expandedComments[post.id]}
									<div class="space-y-2 pt-1">
										{#if cmts?.loading}
											<div class="space-y-2">
												{#each [1,2] as _}
													<div class="flex items-start gap-2">
														<div class="w-7 h-7 rounded-full bg-dark-border/50 animate-pulse shrink-0"></div>
														<div class="flex-1 space-y-1.5">
															<div class="h-2.5 w-24 rounded bg-dark-border/50 animate-pulse"></div>
															<div class="h-2 w-40 rounded bg-dark-border/30 animate-pulse"></div>
														</div>
													</div>
												{/each}
											</div>
										{:else if cmts && cmts.list.length > 0}
											<div class="space-y-2">
												{#each cmts.list as comment (comment.id)}
													<div class="flex items-start gap-2">
														{#if comment.avatar_url}
															<img src={comment.avatar_url} alt={comment.display_name} class="w-7 h-7 rounded-full shrink-0 object-cover" />
														{:else}
															<div class="w-7 h-7 rounded-full {avatarColor(comment.user_id)} flex items-center justify-center text-xs font-bold text-white shrink-0">
																{avatarInitials(comment.display_name)}
															</div>
														{/if}
														<div class="flex-1 min-w-0 bg-dark-bg rounded-lg px-2.5 py-2">
															<div class="flex items-baseline gap-2">
																<span class="text-xs font-semibold text-white">{comment.display_name}</span>
																<time class="text-xs text-gray-600">{timeAgo(comment.created_at)}</time>
															</div>
															<p class="text-xs text-gray-300 mt-0.5 break-words">{comment.content}</p>
														</div>
													</div>
												{/each}
											</div>
										{:else}
											<p class="text-xs text-gray-600 text-center py-2">ยังไม่มีความคิดเห็น</p>
										{/if}

										<!-- Add comment input -->
										<div class="flex items-center gap-2 pt-1">
											<input
												type="text"
												bind:value={newCommentText[post.id]}
												placeholder="เพิ่มความคิดเห็น..."
												maxlength="300"
												onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(post.id); } }}
												class="flex-1 rounded-lg border border-dark-border bg-dark-bg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-brand-primary focus:outline-none"
											/>
											<button
												onclick={() => submitComment(post.id)}
												disabled={submittingComment[post.id] || !(newCommentText[post.id] ?? '').trim()}
												class="rounded-lg bg-brand-primary/80 px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50 hover:bg-brand-primary"
											>
												ส่ง
											</button>
										</div>
									</div>
								{/if}
							</article>
						{/each}

						<!-- Load more -->
						{#if hasMore}
							<div class="flex justify-center">
								<button
									onclick={loadMore}
									disabled={loadingMore}
									class="rounded-lg border border-dark-border px-6 py-2 text-sm text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors disabled:opacity-50"
								>
									{loadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Right: Stats sidebar -->
			<div class="space-y-4">
				<!-- Community stats -->
				<div class="card space-y-3">
					<h3 class="text-sm font-semibold text-white">สถิติชุมชน</h3>
					<div class="grid grid-cols-2 gap-3">
						<div class="rounded-lg bg-dark-bg p-3 text-center">
							<p class="text-xl font-bold text-white">{formatNumber(posts.length)}</p>
							<p class="text-xs text-gray-500 mt-0.5">โพสต์ล่าสุด</p>
						</div>
						<div class="rounded-lg bg-dark-bg p-3 text-center">
							<p class="text-xl font-bold text-white">{formatNumber(data.leaderboard.length)}</p>
							<p class="text-xs text-gray-500 mt-0.5">เทรดเดอร์</p>
						</div>
					</div>
				</div>

				<!-- Mini leaderboard -->
				{#if data.leaderboard.length > 0}
					<div class="card space-y-3">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-semibold text-white">Top Traders</h3>
							<button
								onclick={() => activeTab = 'leaderboard'}
								class="text-xs text-brand-primary hover:underline"
							>ดูทั้งหมด</button>
						</div>
						<div class="space-y-2">
							{#each [...data.leaderboard].sort((a, b) => b.net_pnl - a.net_pnl).slice(0, 5) as entry, i}
								<div class="flex items-center gap-2.5">
									<span class="text-xs font-mono w-5 text-center text-gray-500">{rankMedal(i + 1)}</span>
									{#if entry.avatar_url}
										<img src={entry.avatar_url} alt={entry.display_name} class="w-7 h-7 rounded-full object-cover shrink-0" />
									{:else}
										<div class="w-7 h-7 rounded-full {avatarColor(entry.user_id)} flex items-center justify-center text-xs font-bold text-white shrink-0">
											{avatarInitials(entry.display_name)}
										</div>
									{/if}
									<div class="flex-1 min-w-0">
										<p class="text-xs font-medium text-white truncate">{entry.display_name}</p>
										{#if entry.bio}
											<p class="text-xs text-gray-600 truncate">{entry.bio}</p>
										{/if}
									</div>
									<span class="text-xs font-semibold {pnlColor(entry.net_pnl)} shrink-0">
										{entry.net_pnl >= 0 ? '+' : ''}{formatCurrency(entry.net_pnl)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Tips -->
				<div class="card border border-brand-primary/20 bg-brand-primary/5 space-y-2">
					<h3 class="text-xs font-semibold text-brand-primary">คำแนะนำ</h3>
					<ul class="space-y-1.5 text-xs text-gray-400">
						<li class="flex items-start gap-1.5">
							<span class="text-brand-primary mt-0.5">•</span>
							<span>แบ่งปันเฉพาะข้อมูลที่คุณสบายใจ</span>
						</li>
						<li class="flex items-start gap-1.5">
							<span class="text-brand-primary mt-0.5">•</span>
							<span>ไม่มีการแสดงข้อมูลบัญชีส่วนตัว</span>
						</li>
						<li class="flex items-start gap-1.5">
							<span class="text-brand-primary mt-0.5">•</span>
							<span>สามารถออกจากชุมชนได้ทุกเมื่อ</span>
						</li>
					</ul>
				</div>
			</div>
		</div>

	<!-- ════════════════ LEADERBOARD TAB ════════════════ -->
	{:else}
		<div class="card space-y-4">
			<!-- Sort selector -->
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<h3 class="text-sm font-semibold text-white">ลีดเดอร์บอร์ด — เทรดเดอร์ที่ดีที่สุด</h3>
				<div class="flex items-center gap-1 bg-dark-bg border border-dark-border rounded-lg p-0.5">
					{#each ([
						{ key: 'net_pnl', label: 'Net P&L' },
						{ key: 'win_rate', label: 'Win Rate' },
						{ key: 'profit_factor', label: 'Profit Factor' }
					] as { key: LeaderboardSort; label: string }[]) as opt}
						<button
							onclick={() => leaderboardSort = opt.key}
							class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors
								{leaderboardSort === opt.key
									? 'bg-brand-primary/20 text-brand-primary'
									: 'text-gray-500 hover:text-gray-300'}"
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			{#if leaderboard.length === 0}
				<div class="flex flex-col items-center justify-center py-16 text-center">
					<div class="w-14 h-14 rounded-2xl bg-amber-400/10 flex items-center justify-center mb-4">
						<svg class="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
						</svg>
					</div>
					<h3 class="font-semibold text-white mb-1">ยังไม่มีข้อมูลลีดเดอร์บอร์ด</h3>
					<p class="text-sm text-gray-500 max-w-xs">เมื่อเทรดเดอร์เลือกเปิดเผยสถิติ จะปรากฏที่นี่</p>
				</div>
			{:else}
				<!-- Table header -->
				<div class="overflow-x-auto">
					<table class="w-full text-sm" aria-label="ลีดเดอร์บอร์ด">
						<thead>
							<tr class="border-b border-dark-border text-gray-500 text-xs">
								<th class="text-left pb-2 font-medium w-10">#</th>
								<th class="text-left pb-2 font-medium">เทรดเดอร์</th>
								<th class="text-right pb-2 font-medium">Net P&L</th>
								<th class="text-right pb-2 font-medium hidden sm:table-cell">Win Rate</th>
								<th class="text-right pb-2 font-medium hidden md:table-cell">เทรด</th>
								<th class="text-right pb-2 font-medium hidden lg:table-cell">Profit Factor</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-dark-border/50">
							{#each sortedLeaderboard as entry, i}
								<tr class="hover:bg-dark-surface/40 transition-colors">
									<td class="py-3 pr-2 font-mono text-xs text-gray-400">
										{rankMedal(i + 1)}
									</td>
									<td class="py-3">
										<div class="flex items-center gap-2.5">
											{#if entry.avatar_url}
												<img src={entry.avatar_url} alt={entry.display_name} class="w-8 h-8 rounded-full object-cover shrink-0" />
											{:else}
												<div class="w-8 h-8 rounded-full {avatarColor(entry.user_id)} flex items-center justify-center text-xs font-bold text-white shrink-0">
													{avatarInitials(entry.display_name)}
												</div>
											{/if}
											<div class="min-w-0">
												<p class="font-medium text-white truncate max-w-[120px] sm:max-w-none">{entry.display_name}</p>
												{#if entry.bio}
													<p class="text-xs text-gray-500 truncate max-w-[120px] sm:max-w-xs">{entry.bio}</p>
												{/if}
											</div>
										</div>
									</td>
									<td class="py-3 text-right font-semibold {pnlColor(entry.net_pnl)}">
										{entry.net_pnl >= 0 ? '+' : ''}{formatCurrency(entry.net_pnl)}
									</td>
									<td class="py-3 text-right text-gray-300 hidden sm:table-cell">
										{formatPercent(entry.win_rate / 100)}
									</td>
									<td class="py-3 text-right text-gray-400 hidden md:table-cell">
										{formatNumber(entry.total_trades)}
									</td>
									<td class="py-3 text-right text-gray-300 hidden lg:table-cell">
										{entry.profit_factor >= 99 ? '∞' : formatNumber(entry.profit_factor, 2)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Note -->
				<p class="text-xs text-gray-600 text-center pt-2">
					แสดงเฉพาะเทรดเดอร์ที่เลือกเปิดเผยข้อมูลสาธารณะ
				</p>
			{/if}
		</div>
	{/if}
</div>
