<script lang="ts">
	import { formatCurrency, formatNumber, sanitizeHtml } from '$lib/utils';

	let recapPeriod = $state<'this_week' | 'last_week' | 'this_month' | 'last_month'>('last_week');
	let recapGenerating = $state(false);
	let recapError = $state('');
	let recapSections = $state<Record<string, { content: string; loading: boolean }>>({
		performance_summary: { content: '', loading: false },
		patterns: { content: '', loading: false },
		mistakes: { content: '', loading: false },
		strengths: { content: '', loading: false },
		action_plan: { content: '', loading: false },
	});
	type RecapStats = { netPnl: number; tradeWinRate: number; profitFactor: number; totalTrades: number };
	let recapStats = $state<RecapStats | null>(null);
	let recapPrevStats = $state<RecapStats | null>(null);
	let recapTimestamp = $state('');

	function getRecapPeriodDates(period: string): { start: string; end: string; type: string } {
		const now = new Date();
		const thai = new Date(now.getTime() + 7 * 60 * 60 * 1000);
		const todayStr = thai.toISOString().split('T')[0];
		const today = new Date(todayStr + 'T00:00:00');
		const dayOfWeek = today.getDay();

		if (period === 'this_week') {
			const start = new Date(today); start.setDate(today.getDate() - dayOfWeek);
			return { start: start.toISOString().split('T')[0], end: todayStr, type: 'week' };
		}
		if (period === 'last_week') {
			const end = new Date(today); end.setDate(today.getDate() - dayOfWeek - 1);
			const start = new Date(end); start.setDate(end.getDate() - 6);
			return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], type: 'week' };
		}
		if (period === 'this_month') {
			const start = `${todayStr.substring(0, 7)}-01`;
			return { start, end: todayStr, type: 'month' };
		}
		// last_month
		const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
		const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
		return {
			start: lastMonth.toISOString().split('T')[0],
			end: lastMonthEnd.toISOString().split('T')[0],
			type: 'month'
		};
	}

	async function loadCachedRecap() {
		const { start, type } = getRecapPeriodDates(recapPeriod);
		try {
			const res = await fetch(`/api/portfolio/recaps?period_type=${type}&period_start=${start}`);
			if (res.ok) {
				const { recap } = await res.json();
				if (recap?.sections) {
					const sections = recap.sections as Record<string, string>;
					for (const [key, value] of Object.entries(sections)) {
						if (recapSections[key]) {
							recapSections[key] = { content: value, loading: false };
						}
					}
					recapStats = recap.stats;
					recapTimestamp = new Date(recap.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
					return true;
				}
			}
		} catch { /* ignore */ }
		return false;
	}

	async function generateRecap() {
		recapGenerating = true;
		recapError = '';
		for (const key of Object.keys(recapSections)) {
			recapSections[key] = { content: '', loading: false };
		}
		recapStats = null;
		recapPrevStats = null;

		const { start, end, type } = getRecapPeriodDates(recapPeriod);

		try {
			const res = await fetch('/api/portfolio/recaps', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ period_type: type, period_start: start, period_end: end })
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				recapError = res.status === 429
					? 'สรุปบ่อยเกินไป กรุณารอสักครู่ (จำกัด 3 ครั้ง/ชั่วโมง)'
					: data.message || 'เกิดข้อผิดพลาด';
				recapGenerating = false;
				return;
			}

			const reader = res.body?.getReader();
			if (!reader) { recapError = 'ไม่สามารถเชื่อมต่อได้'; recapGenerating = false; return; }

			const decoder = new TextDecoder();
			let buffer = '';
			let currentSection = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const chunk = JSON.parse(line);
						if (chunk.type === 'stats') {
							recapStats = chunk.stats;
							recapPrevStats = chunk.prevStats;
						} else if (chunk.type === 'section_start') {
							currentSection = chunk.section;
							if (recapSections[currentSection]) {
								recapSections[currentSection] = { content: '', loading: true };
							}
						} else if (chunk.type === 'text_delta' && currentSection && recapSections[currentSection]) {
							recapSections[currentSection].content += chunk.text;
						} else if (chunk.type === 'section_end' && recapSections[currentSection]) {
							recapSections[currentSection].loading = false;
						} else if (chunk.type === 'error') {
							recapError = chunk.message || 'AI error';
						}
					} catch { /* skip */ }
				}
			}

			for (const key of Object.keys(recapSections)) {
				if (recapSections[key].loading) recapSections[key].loading = false;
			}
			recapTimestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
		} catch {
			recapError = 'ไม่สามารถเชื่อมต่อได้ ลองอีกครั้ง';
		} finally {
			recapGenerating = false;
		}
	}

	function recapRenderMarkdown(text: string): string {
		let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		html = html.replace(/^### (.+)$/gm, (_, c) => `<h4 class="text-sm font-bold text-white mt-3 mb-1">${c}</h4>`);
		html = html.replace(/^## (.+)$/gm, (_, c) => `<h3 class="text-base font-bold text-white mt-4 mb-2">${c}</h3>`);
		html = html.replace(/((?:^- .+\n?)+)/gm, (block) => {
			const items = block.trim().split('\n').map((line: string) => `<li>${line.replace(/^- /, '')}</li>`);
			return `<ul class="list-disc list-inside space-y-1 text-sm text-gray-300">${items.join('')}</ul>`;
		});
		html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
			const items = block.trim().split('\n').map((line: string) => `<li>${line.replace(/^\d+\. /, '')}</li>`);
			return `<ol class="list-decimal list-inside space-y-1 text-sm text-gray-300">${items.join('')}</ol>`;
		});
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>');
		html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
		html = html.replace(/\n/g, '<br>');
		html = html.replace(/<br>\s*(<(?:h[2-4]|ul|ol))/g, '$1');
		html = html.replace(/(<\/(?:h[2-4]|ul|ol)>)\s*<br>/g, '$1');
		return html;
	}

	const recapSectionConfig = [
		{ key: 'performance_summary', title: 'สรุปผลการเทรด', icon: '📊' },
		{ key: 'patterns', title: 'รูปแบบที่พบ', icon: '🔍' },
		{ key: 'mistakes', title: 'ข้อผิดพลาด', icon: '⚠️' },
		{ key: 'strengths', title: 'จุดแข็ง', icon: '💪' },
		{ key: 'action_plan', title: 'แผนปรับปรุง', icon: '🎯' },
	];

	const recapPeriodLabels: Record<string, string> = {
		this_week: 'สัปดาห์นี้',
		last_week: 'สัปดาห์ที่แล้ว',
		this_month: 'เดือนนี้',
		last_month: 'เดือนที่แล้ว',
	};
</script>

<!-- RECAPS & INSIGHTS -->
<div class="space-y-6">
	<!-- Period selector -->
	<div class="flex flex-wrap items-center gap-2">
		<div class="flex gap-1.5 flex-wrap">
			{#each ['last_week', 'this_week', 'last_month', 'this_month'] as period}
				<button
					class="px-4 py-2 text-sm rounded-lg border transition-colors {recapPeriod === period ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/40' : 'text-gray-400 border-dark-border hover:text-gray-300'}"
					onclick={() => { recapPeriod = period as typeof recapPeriod; recapStats = null; recapTimestamp = ''; for (const k of Object.keys(recapSections)) recapSections[k] = { content: '', loading: false }; }}
				>{recapPeriodLabels[period]}</button>
			{/each}
		</div>
		{#if recapTimestamp}
			<div class="text-xs text-gray-500">สรุปเมื่อ: {recapTimestamp}</div>
		{/if}
	</div>

	<!-- Stats snapshot -->
	{#if recapStats}
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
			<div class="card">
				<div class="text-xs text-gray-500">กำไรสุทธิ</div>
				<div class="mt-1 text-2xl font-bold {recapStats.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}">{formatCurrency(recapStats.netPnl)}</div>
				{#if recapPrevStats}
					<div class="mt-1 text-xs {recapStats.netPnl >= recapPrevStats.netPnl ? 'text-green-400' : 'text-red-400'}">
						{recapStats.netPnl >= recapPrevStats.netPnl ? '↑' : '↓'} เทียบ {formatCurrency(recapPrevStats.netPnl)}
					</div>
				{/if}
			</div>
			<div class="card">
				<div class="text-xs text-gray-500">อัตราชนะ</div>
				<div class="mt-1 text-2xl font-bold {recapStats.tradeWinRate >= 50 ? 'text-green-400' : 'text-amber-400'}">{recapStats.tradeWinRate?.toFixed(1)}%</div>
				{#if recapPrevStats}
					<div class="mt-1 text-xs {recapStats.tradeWinRate >= recapPrevStats.tradeWinRate ? 'text-green-400' : 'text-red-400'}">
						{recapStats.tradeWinRate >= recapPrevStats.tradeWinRate ? '↑' : '↓'} เทียบ {recapPrevStats.tradeWinRate?.toFixed(1)}%
					</div>
				{/if}
			</div>
			<div class="card">
				<div class="text-xs text-gray-500">อัตราส่วนกำไร</div>
				<div class="mt-1 text-2xl font-bold {recapStats.profitFactor >= 1 ? 'text-green-400' : 'text-red-400'}">{formatNumber(recapStats.profitFactor)}</div>
			</div>
			<div class="card">
				<div class="text-xs text-gray-500">จำนวนเทรด</div>
				<div class="mt-1 text-2xl font-bold text-white">{recapStats.totalTrades}</div>
			</div>
		</div>
	{/if}

	{#if recapError}
		<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">
			{recapError}
		</div>
	{/if}

	<!-- Generate button or sections -->
	{#if !recapSections.performance_summary.content && !recapGenerating}
		<div class="card text-center py-12">
			<div class="text-4xl mb-4">🤖</div>
			<h3 class="text-lg font-semibold text-white mb-2">AI Recap & Insights</h3>
			<p class="text-sm text-gray-400 mb-6">สรุปผลการเทรด{recapPeriodLabels[recapPeriod]} วิเคราะห์จุดแข็ง จุดอ่อน และแผนปรับปรุง</p>
			<div class="flex gap-3 justify-center">
				<button
					onclick={async () => { if (await loadCachedRecap()) return; generateRecap(); }}
					class="px-6 py-3 rounded-lg bg-brand-primary text-dark-bg font-semibold hover:opacity-90 transition-opacity"
				>สรุปผลด้วย AI</button>
			</div>
		</div>
	{:else}
		<!-- Streaming sections -->
		<div class="space-y-4">
			{#each recapSectionConfig as cfg}
				{@const section = recapSections[cfg.key]}
				{#if section?.content || section?.loading || recapGenerating}
					<div class="card">
						<div class="flex items-center gap-2 mb-3">
							<span class="text-lg">{cfg.icon}</span>
							<h3 class="text-base font-semibold text-white">{cfg.title}</h3>
							{#if section?.loading}
								<div class="ml-auto flex items-center gap-1.5 text-xs text-brand-primary">
									<div class="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></div>
									กำลังวิเคราะห์...
								</div>
							{/if}
						</div>
						{#if section?.content}
							<div class="prose-sm text-gray-300 leading-relaxed">
								{@html sanitizeHtml(recapRenderMarkdown(section.content))}
							</div>
						{:else if !section?.loading && recapGenerating}
							<!-- Skeleton -->
							<div class="space-y-2 animate-pulse">
								<div class="h-3 bg-dark-border/30 rounded w-3/4"></div>
								<div class="h-3 bg-dark-border/30 rounded w-1/2"></div>
								<div class="h-3 bg-dark-border/30 rounded w-5/6"></div>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>

		<!-- Regenerate button -->
		{#if !recapGenerating && recapSections.performance_summary.content}
			<div class="flex justify-end">
				<button
					onclick={generateRecap}
					class="flex items-center gap-2 px-4 py-2 rounded-lg border border-dark-border text-sm text-gray-400 hover:text-white hover:border-brand-primary/40 transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
					สร้างใหม่
				</button>
			</div>
		{/if}
	{/if}
</div>
