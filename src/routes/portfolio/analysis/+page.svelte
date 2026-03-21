<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { sanitizeHtml } from '$lib/utils';

	let { data } = $props();

	// --- Section config ---
	const SECTION_CONFIG = [
		{ key: 'market_bias', title: 'Market Bias', subtitle: 'ทิศทางตลาด', icon: 'compass' },
		{ key: 'liquidity_map', title: 'Liquidity Map', subtitle: 'แผนที่สภาพคล่อง', icon: 'layers' },
		{ key: 'setup', title: 'Setup', subtitle: 'Setup การเทรด', icon: 'crosshair' },
		{ key: 'scenario', title: 'Scenario', subtitle: 'สถานการณ์', icon: 'branch' },
		{ key: 'key_levels', title: 'Key Levels', subtitle: 'ระดับราคาสำคัญ', icon: 'bars' },
		{ key: 'trade_plan', title: 'Trade Plan', subtitle: 'แผนการเทรด', icon: 'clipboard' }
	] as const;

	// --- State ---
	let sections = $state<Record<string, { content: string; loading: boolean }>>({
		market_bias: { content: '', loading: false },
		liquidity_map: { content: '', loading: false },
		setup: { content: '', loading: false },
		scenario: { content: '', loading: false },
		key_levels: { content: '', loading: false },
		trade_plan: { content: '', loading: false }
	});
	let generating = $state(false);
	let error = $state('');
	let lastUpdated = $state('');
	let tvContainer = $state<HTMLDivElement>();

	// --- Markdown renderer (from AiChatMessage) ---
	function renderMarkdown(text: string): string {
		let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		// Tables
		html = html.replace(
			/((?:^\|.+\|[ \t]*\n?)+)/gm,
			(tableBlock) => {
				const rows = tableBlock.trim().split('\n').filter(r => r.trim());
				if (rows.length < 2) return tableBlock;
				const isSeparator = (row: string) => /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(row.trim());
				const hasSeparator = isSeparator(rows[1]);
				const parseRow = (row: string) => row.split('|').slice(1, -1).map(cell => cell.trim());
				let tableHtml = '<div class="analysis-table-wrap"><table class="analysis-table">';
				if (hasSeparator) {
					const headers = parseRow(rows[0]);
					tableHtml += '<thead><tr>';
					headers.forEach(h => { tableHtml += `<th>${applyInline(h)}</th>`; });
					tableHtml += '</tr></thead><tbody>';
					for (let i = 2; i < rows.length; i++) {
						const cells = parseRow(rows[i]);
						tableHtml += '<tr>';
						cells.forEach(c => { tableHtml += `<td>${applyInline(c)}</td>`; });
						tableHtml += '</tr>';
					}
					tableHtml += '</tbody>';
				} else {
					tableHtml += '<tbody>';
					rows.forEach(row => {
						const cells = parseRow(row);
						tableHtml += '<tr>';
						cells.forEach(c => { tableHtml += `<td>${applyInline(c)}</td>`; });
						tableHtml += '</tr>';
					});
					tableHtml += '</tbody>';
				}
				tableHtml += '</table></div>';
				return tableHtml;
			}
		);

		html = html.replace(/^### (.+)$/gm, (_, c) => `<h4 class="analysis-h3">${escapeHtml(c)}</h4>`);
		html = html.replace(/^## (.+)$/gm, (_, c) => `<h3 class="analysis-h2">${escapeHtml(c)}</h3>`);
		html = html.replace(/^# (.+)$/gm, (_, c) => `<h2 class="analysis-h1">${escapeHtml(c)}</h2>`);

		html = html.replace(
			/((?:^- .+\n?)+)/gm,
			(block) => {
				const items = block.trim().split('\n').map(line => {
					const content = line.replace(/^- /, '');
					return `<li>${applyInline(content)}</li>`;
				});
				return `<ul class="analysis-list">${items.join('')}</ul>`;
			}
		);

		html = html.replace(
			/((?:^\d+\. .+\n?)+)/gm,
			(block) => {
				const items = block.trim().split('\n').map(line => {
					const content = line.replace(/^\d+\. /, '');
					return `<li>${applyInline(content)}</li>`;
				});
				return `<ol class="analysis-ol">${items.join('')}</ol>`;
			}
		);

		html = applyInline(html);
		html = html.replace(/\n/g, '<br>');
		html = html.replace(/<br>\s*(<(?:h[2-4]|ul|ol|div|table))/g, '$1');
		html = html.replace(/(<\/(?:h[2-4]|ul|ol|div|table)>)\s*<br>/g, '$1');
		return html;
	}

	function escapeHtml(str: string): string {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function applyInline(text: string): string {
		text = text.replace(/\*\*(.+?)\*\*/g, (_, c) => `<strong>${escapeHtml(c)}</strong>`);
		text = text.replace(/\*(.+?)\*/g, (_, c) => `<em>${escapeHtml(c)}</em>`);
		text = text.replace(/`(.+?)`/g, (_, c) => `<code class="analysis-code">${escapeHtml(c)}</code>`);
		return text;
	}

	// --- TradingView widget ---
	function initTradingView() {
		if (!browser || !tvContainer) return;

		const script = document.createElement('script');
		script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
		script.async = true;
		script.innerHTML = JSON.stringify({
			autosize: true,
			symbol: 'OANDA:XAUUSD',
			interval: '60',
			timezone: 'Asia/Bangkok',
			theme: 'dark',
			style: '1',
			locale: 'th_TH',
			backgroundColor: 'rgba(10, 10, 10, 1)',
			gridColor: 'rgba(38, 38, 38, 0.6)',
			hide_top_toolbar: false,
			hide_legend: false,
			allow_symbol_change: false,
			save_image: false,
			calendar: false,
			support_host: 'https://www.tradingview.com'
		});

		tvContainer.innerHTML = '';
		const wrapper = document.createElement('div');
		wrapper.className = 'tradingview-widget-container__widget';
		wrapper.style.height = '100%';
		wrapper.style.width = '100%';
		tvContainer.appendChild(wrapper);
		tvContainer.appendChild(script);
	}

	// --- Generate analysis ---
	async function generateAnalysis() {
		if (generating) return;
		generating = true;
		error = '';

		// Reset sections
		for (const key of Object.keys(sections)) {
			sections[key] = { content: '', loading: true };
		}

		try {
			const res = await fetch('/api/portfolio/analysis', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				if (res.status === 429) {
					error = 'วิเคราะห์บ่อยเกินไป กรุณารอสักครู่ (จำกัด 5 ครั้ง/ชั่วโมง)';
				} else {
					error = data.message || 'เกิดข้อผิดพลาด';
				}
				for (const key of Object.keys(sections)) {
					sections[key] = { content: '', loading: false };
				}
				generating = false;
				return;
			}

			const reader = res.body?.getReader();
			if (!reader) {
				error = 'ไม่สามารถเชื่อมต่อได้';
				generating = false;
				return;
			}

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
						if (chunk.type === 'section_start') {
							currentSection = chunk.section;
							if (sections[currentSection]) {
								sections[currentSection].loading = true;
								sections[currentSection].content = '';
							}
						} else if (chunk.type === 'text_delta' && currentSection && sections[currentSection]) {
							sections[currentSection].content += chunk.text;
						} else if (chunk.type === 'section_end' && sections[currentSection]) {
							sections[currentSection].loading = false;
						} else if (chunk.type === 'error') {
							error = chunk.message || 'AI error';
						}
					} catch {
						// skip malformed lines
					}
				}
			}

			// Mark any still-loading sections as done
			for (const key of Object.keys(sections)) {
				if (sections[key].loading) {
					sections[key].loading = false;
				}
			}

			lastUpdated = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
		} catch {
			error = 'ไม่สามารถเชื่อมต่อได้ ลองอีกครั้ง';
		} finally {
			generating = false;
		}
	}

	// --- Init ---
	onMount(() => {
		initTradingView();

		// Load from cache or auto-generate
		if (data.cachedAnalysis?.sections) {
			const cached = data.cachedAnalysis.sections as Record<string, string>;
			for (const [key, value] of Object.entries(cached)) {
				if (sections[key]) {
					sections[key] = { content: value, loading: false };
				}
			}
			lastUpdated = new Date(data.cachedAnalysis.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
		} else {
			generateAnalysis();
		}
	});

	// --- Section icon SVGs ---
	const sectionIcons: Record<string, string> = {
		compass: '<path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />',
		layers: '<path stroke-linecap="round" stroke-linejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75l-5.571-3m11.142 0l4.179 2.25L12 17.25l-9.75-5.25 4.179-2.25m11.142 0l4.179 2.25L12 21.75l-9.75-5.25 4.179-2.25" />',
		crosshair: '<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />',
		branch: '<path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />',
		bars: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />',
		clipboard: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />'
	};
</script>

<svelte:head>
	<title>วิเคราะห์ทองคำ - IB Portal</title>
</svelte:head>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-bold text-white flex items-center gap-2">
				<span class="text-yellow-500">
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
					</svg>
				</span>
				วิเคราะห์ทองคำประจำวัน
				<span class="text-xs font-normal text-gray-500 ml-1">XAUUSD</span>
			</h2>
			{#if lastUpdated}
				<p class="text-xs text-gray-500 mt-0.5">อัพเดทล่าสุด: {lastUpdated}</p>
			{/if}
		</div>
		<button
			onclick={generateAnalysis}
			disabled={generating}
			class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg
				bg-brand-600 hover:bg-brand-700 text-white
				disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
		>
			<svg
				class="w-4 h-4 {generating ? 'animate-spin' : ''}"
				fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round"
					d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
			</svg>
			{generating ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ใหม่'}
		</button>
	</div>

	<!-- TradingView Chart -->
	<div class="card overflow-hidden" style="height: 400px;">
		<div
			bind:this={tvContainer}
			class="tradingview-widget-container w-full h-full"
		></div>
	</div>

	<!-- Error -->
	{#if error}
		<div class="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
			<p class="text-sm text-red-400">{error}</p>
		</div>
	{/if}

	<!-- Analysis Sections Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		{#each SECTION_CONFIG as cfg}
			{@const section = sections[cfg.key]}
			<div class="card p-0 overflow-hidden">
				<!-- Section header -->
				<div class="flex items-center gap-2.5 px-4 py-3 border-b border-dark-border bg-dark-bg/50">
					<div class="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center flex-shrink-0">
						<svg class="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							{@html sectionIcons[cfg.icon]}
						</svg>
					</div>
					<div>
						<h3 class="text-sm font-semibold text-white">{cfg.title}</h3>
						<p class="text-xs text-gray-500">{cfg.subtitle}</p>
					</div>
					{#if section.loading}
						<div class="ml-auto flex gap-1">
							<span class="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
							<span class="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
							<span class="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
						</div>
					{/if}
				</div>

				<!-- Section content -->
				<div class="px-4 py-3 text-sm text-gray-300 leading-relaxed analysis-content min-h-[80px]">
					{#if section.content}
						{@html sanitizeHtml(renderMarkdown(section.content))}
					{:else if section.loading}
						<!-- Skeleton -->
						<div class="space-y-2 animate-pulse">
							<div class="h-3 bg-dark-hover rounded w-3/4"></div>
							<div class="h-3 bg-dark-hover rounded w-full"></div>
							<div class="h-3 bg-dark-hover rounded w-5/6"></div>
							<div class="h-3 bg-dark-hover rounded w-2/3"></div>
						</div>
					{:else if !generating}
						<p class="text-gray-600 text-center py-4">กดปุ่ม "วิเคราะห์ใหม่" เพื่อเริ่มวิเคราะห์</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	/* Analysis content styles */
	:global(.analysis-content .analysis-h1) {
		font-size: 1rem;
		font-weight: 700;
		color: white;
		margin: 0.75rem 0 0.25rem;
	}
	:global(.analysis-content .analysis-h2) {
		font-size: 0.9rem;
		font-weight: 700;
		color: white;
		margin: 0.75rem 0 0.25rem;
	}
	:global(.analysis-content .analysis-h3) {
		font-size: 0.85rem;
		font-weight: 600;
		color: #e5e7eb;
		margin: 0.6rem 0 0.2rem;
	}

	:global(.analysis-content .analysis-list),
	:global(.analysis-content .analysis-ol) {
		margin: 0.35rem 0;
		padding-left: 1.25rem;
	}
	:global(.analysis-content .analysis-list) {
		list-style-type: disc;
	}
	:global(.analysis-content .analysis-ol) {
		list-style-type: decimal;
	}
	:global(.analysis-content .analysis-list li),
	:global(.analysis-content .analysis-ol li) {
		margin: 0.15rem 0;
		line-height: 1.6;
	}

	:global(.analysis-content .analysis-code) {
		background: rgba(255, 255, 255, 0.08);
		padding: 0.1rem 0.35rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	:global(.analysis-content .analysis-table-wrap) {
		overflow-x: auto;
		margin: 0.5rem 0;
		border-radius: 0.5rem;
		border: 1px solid #262626;
	}
	:global(.analysis-content .analysis-table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
		white-space: nowrap;
	}
	:global(.analysis-content .analysis-table th) {
		background: rgba(201, 168, 76, 0.08);
		padding: 0.4rem 0.6rem;
		text-align: left;
		font-weight: 600;
		color: #C9A84C;
		border-bottom: 1px solid #262626;
	}
	:global(.analysis-content .analysis-table td) {
		padding: 0.35rem 0.6rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		color: #9ca3af;
	}
	:global(.analysis-content .analysis-table tbody tr:last-child td) {
		border-bottom: none;
	}
	:global(.analysis-content .analysis-table tbody tr:hover) {
		background: rgba(255, 255, 255, 0.02);
	}
</style>
