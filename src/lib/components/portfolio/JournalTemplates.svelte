<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	interface DayTrade {
		symbol: string;
		type: string;
		profit: number | null;
	}

	interface JournalFields {
		preMarketNotes: string;
		postMarketNotes: string;
		sessionPlan: string;
		marketBias: string;
		keyLevels: string;
		lessons: string;
		tomorrowFocus: string;
	}

	interface Template {
		id: string;
		name: string;
		description: string;
		icon: string;
		colorClass: string;
		sections: string[];
		getFields: (trades: DayTrade[]) => Partial<JournalFields>;
	}

	let {
		open = $bindable(false),
		dayTrades = [],
		onApply
	}: {
		open: boolean;
		dayTrades: DayTrade[];
		onApply: (fields: Partial<JournalFields>) => void;
	} = $props();

	const templates: Template[] = [
		{
			id: 'pre-market',
			name: 'ก่อนเปิดตลาด',
			description: 'วางแผนการเทรดก่อนเริ่ม session พร้อม checklist และเป้าหมาย',
			icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
			colorClass: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
			sections: ['บันทึกก่อนเทรด', 'แผนการเทรด', 'มุมมองตลาด', 'ระดับราคาสำคัญ'],
			getFields: () => ({
				preMarketNotes: 'สภาพจิตใจ: \nข่าวสำคัญวันนี้: \nสิ่งที่ต้องระวัง: \nพร้อมเทรดหรือไม่: ',
				sessionPlan: 'Session ที่จะเทรด: \nPairs ที่จะโฟกัส: \nกลยุทธ์ที่ใช้: \n\nเป้าหมาย: Profit $___  / Max Loss $___\n\nเงื่อนไขที่จะ SKIP วันนี้:\n- ',
				marketBias: 'Bullish / Bearish / Sideways\nเหตุผล: ',
				keyLevels: 'Support: \nResistance: \nKey Level: \nInvalidation: '
			})
		},
		{
			id: 'post-market',
			name: 'หลังปิดตลาด',
			description: 'สรุปผลการเทรด บทเรียน และวางแผนวันถัดไป (auto-fill จากเทรดวันนี้)',
			icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0',
			colorClass: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
			sections: ['บันทึกหลังเทรด', 'บทเรียน', 'จุดโฟกัสพรุ่งนี้'],
			getFields: (trades: DayTrade[]) => {
				const wins = trades.filter((t) => (t.profit ?? 0) > 0);
				const losses = trades.filter((t) => (t.profit ?? 0) <= 0 && (t.profit ?? 0) !== 0);
				const totalPnl = trades.reduce((sum, t) => sum + (t.profit ?? 0), 0);
				const symbols = [...new Set(trades.map((t) => t.symbol))];

				const autoSummary =
					trades.length > 0
						? `สรุปผลวันนี้: ${trades.length} เทรด | ชนะ ${wins.length} | แพ้ ${losses.length} | P&L: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}\nSymbols: ${symbols.join(', ') || '-'}\n\n`
						: '';

				return {
					postMarketNotes: `${autoSummary}จุดที่ทำได้ดี:\n- \n\nจุดที่ต้องปรับปรุง:\n- \n\nความรู้สึกหลังเทรด: `,
					lessons: 'บทเรียนที่ได้วันนี้:\n1. \n2. \n\nกฎที่ละเมิด (ถ้ามี): \n\nสิ่งที่จะทำต่างออกไปครั้งหน้า: ',
					tomorrowFocus: 'สิ่งที่จะโฟกัสพรุ่งนี้:\n1. \n2. \n\nสิ่งที่จะ AVOID: '
				};
			}
		},
		{
			id: 'weekly-review',
			name: 'ทบทวนรายสัปดาห์',
			description: 'วิเคราะห์ผลสัปดาห์ ปรับกลยุทธ์ และตั้งเป้าหมายสัปดาห์หน้า',
			icon: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 0-2 2h-2a2 2 0 0 0-2-2z',
			colorClass: 'text-green-400 bg-green-400/10 border-green-400/30',
			sections: ['บันทึกทบทวน', 'แผนสัปดาห์หน้า', 'บทเรียน', 'จุดโฟกัส'],
			getFields: () => ({
				preMarketNotes: 'ทบทวนรายสัปดาห์\n\nสิ่งที่ทำได้ดีสัปดาห์นี้:\n1. \n2. \n\nสิ่งที่ต้องแก้ไข:\n1. \n2. ',
				sessionPlan: 'แผนสัปดาห์หน้า\n\nกลยุทธ์ที่จะใช้: \nPairs หลัก: \nเป้าหมาย P&L: $___\nMax Risk ต่อวัน: $___\n\nTheme ของสัปดาห์: ',
				lessons: 'สถิติสัปดาห์นี้\nWin Rate: ___% | Profit Factor: ___ | Best Trade: $___ | Worst Trade: $___\n\nPattern ที่สังเกตเห็น:\n- \n\nบทเรียนสำคัญ:\n1. \n2. ',
				tomorrowFocus: 'เป้าหมายสัปดาห์หน้า:\n1. \n2. \n3. \n\nสิ่งที่จะทดลองทำ: '
			})
		}
	];

	let selectedId = $state<string | null>(null);

	function handleApply() {
		const template = templates.find((t) => t.id === selectedId);
		if (!template) return;
		onApply(template.getFields(dayTrades));
		open = false;
		selectedId = null;
	}

	function handleClose() {
		open = false;
		selectedId = null;
	}
</script>

{#if open}
	<!-- backdrop -->
	<button
		transition:fade={{ duration: 200 }}
		type="button"
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
		onclick={handleClose}
		aria-label="ปิด"
	></button>

	<!-- modal -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="template-modal-title"
	>
		<div transition:fly={{ y: 30, duration: 250 }} class="w-full max-w-2xl rounded-2xl bg-dark-surface border border-dark-border shadow-2xl">
			<!-- header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-dark-border">
				<div>
					<h2 id="template-modal-title" class="text-base font-semibold text-white">เลือก Template</h2>
					<p class="text-xs text-gray-500 mt-0.5">เลือก template เพื่อ auto-fill ช่องในบันทึก</p>
				</div>
				<button
					type="button"
					onclick={handleClose}
					class="rounded-lg p-1.5 text-gray-500 hover:text-white hover:bg-dark-border/50 transition-colors"
					aria-label="ปิด"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- template cards -->
			<div class="p-6 space-y-3">
				{#each templates as template}
					<button
						type="button"
						onclick={() => (selectedId = selectedId === template.id ? null : template.id)}
						class="w-full text-left rounded-xl border p-4 transition-all
							{selectedId === template.id
								? 'border-brand-primary bg-brand-primary/10'
								: 'border-dark-border bg-dark-bg/40 hover:border-dark-border/80 hover:bg-dark-bg/60'}"
					>
						<div class="flex items-start gap-3">
							<!-- icon -->
							<div class="shrink-0 rounded-lg p-2 border {template.colorClass}">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={template.icon} />
								</svg>
							</div>

							<!-- text -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-white">{template.name}</span>
									{#if template.id === 'post-market' && dayTrades.length > 0}
										<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
											auto-fill {dayTrades.length} เทรด
										</span>
									{/if}
								</div>
								<p class="text-xs text-gray-500 mt-0.5">{template.description}</p>
								<div class="flex flex-wrap gap-1.5 mt-2">
									{#each template.sections as section}
										<span class="text-[10px] px-2 py-0.5 rounded-full bg-dark-border/50 text-gray-400">{section}</span>
									{/each}
								</div>
							</div>

							<!-- radio -->
							<div class="shrink-0 mt-0.5">
								<div class="w-4 h-4 rounded-full border-2 flex items-center justify-center
									{selectedId === template.id ? 'border-brand-primary' : 'border-dark-border'}">
									{#if selectedId === template.id}
										<div class="w-2 h-2 rounded-full bg-brand-primary"></div>
									{/if}
								</div>
							</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-border">
				<button
					type="button"
					onclick={handleClose}
					class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
				>
					ยกเลิก
				</button>
				<button
					type="button"
					onclick={handleApply}
					disabled={!selectedId}
					class="btn-primary text-sm py-2 px-5 disabled:opacity-40 disabled:cursor-not-allowed"
				>
					ใช้ Template นี้
				</button>
			</div>
		</div>
	</div>
{/if}
