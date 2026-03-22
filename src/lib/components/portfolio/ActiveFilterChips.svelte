<script lang="ts">
	import type { PortfolioFilterState, PortfolioFilterOptions, TradeTag, Playbook } from '$lib/types';
	import { slide } from 'svelte/transition';

	let {
		filters,
		filterOptions = {},
		tags = [],
		playbooks = [],
		onremove,
		onclear
	}: {
		filters: PortfolioFilterState;
		filterOptions?: PortfolioFilterOptions;
		tags?: TradeTag[];
		playbooks?: Playbook[];
		onremove: (filterKey: string, value?: string) => void;
		onclear: () => void;
	} = $props();

	const SESSION_LABELS: Record<string, string> = { asian: 'เอเชีย', london: 'ลอนดอน', newyork: 'นิวยอร์ก' };
	const OUTCOME_LABELS: Record<string, string> = { win: 'กำไร', loss: 'ขาดทุน', breakeven: 'เสมอตัว' };
	const DURATION_LABELS: Record<string, string> = { scalp: 'Scalp', intraday: 'Intraday', swing: 'Swing', position: 'Position' };
	const REVIEW_LABELS: Record<string, string> = { unreviewed: 'ยังไม่รีวิว', in_progress: 'กำลังรีวิว', reviewed: 'รีวิวแล้ว' };
	const DOW_LABELS: Record<number, string> = { 0: 'อา', 1: 'จ', 2: 'อ', 3: 'พ', 4: 'พฤ', 5: 'ศ', 6: 'ส' };

	interface Chip { key: string; label: string; value?: string; }

	let chips = $derived.by(() => {
		const c: Chip[] = [];

		if (filters.q) c.push({ key: 'q', label: `ค้นหา: ${filters.q}` });

		if (filters.from && filters.to) {
			c.push({ key: 'dateRange', label: `วันที่: ${filters.from} - ${filters.to}` });
		} else if (filters.from) {
			c.push({ key: 'from', label: `ตั้งแต่: ${filters.from}` });
		} else if (filters.to) {
			c.push({ key: 'to', label: `ถึง: ${filters.to}` });
		}

		for (const s of filters.symbols) c.push({ key: 'symbols', value: s, label: `สัญลักษณ์: ${s}` });
		for (const s of filters.sessions) c.push({ key: 'sessions', value: s, label: `เซสชัน: ${SESSION_LABELS[s] || s}` });
		for (const d of filters.directions) c.push({ key: 'directions', value: d, label: `ทิศทาง: ${d}` });
		for (const rs of filters.reviewStatus) c.push({ key: 'reviewStatus', value: rs, label: `รีวิว: ${REVIEW_LABELS[rs] || rs}` });

		for (const tid of filters.tagIds) {
			const tag = tags.find((t: TradeTag) => t.id === tid);
			c.push({ key: 'tagIds', value: tid, label: `แท็ก: ${tag?.name || tid}` });
		}
		for (const pid of filters.playbookIds) {
			const pb = playbooks.find((p: Playbook) => p.id === pid);
			c.push({ key: 'playbookIds', value: pid, label: `กลยุทธ์: ${pb?.name || pid}` });
		}

		if (filters.outcome) c.push({ key: 'outcome', label: `ผลลัพธ์: ${OUTCOME_LABELS[filters.outcome]}` });
		if (filters.hasNotes != null) c.push({ key: 'hasNotes', label: `โน้ต: ${filters.hasNotes ? 'มี' : 'ไม่มี'}` });
		if (filters.hasAttachments != null) c.push({ key: 'hasAttachments', label: `ไฟล์แนบ: ${filters.hasAttachments ? 'มี' : 'ไม่มี'}` });
		if (filters.durationBucket) c.push({ key: 'durationBucket', label: `ระยะเวลา: ${DURATION_LABELS[filters.durationBucket]}` });

		// Numeric ranges
		if (filters.profitMin != null || filters.profitMax != null) {
			const parts = [];
			if (filters.profitMin != null) parts.push(`$${filters.profitMin}`);
			parts.push('-');
			if (filters.profitMax != null) parts.push(`$${filters.profitMax}`);
			c.push({ key: 'profitRange', label: `P&L: ${parts.join(' ')}` });
		}
		if (filters.lotSizeMin != null || filters.lotSizeMax != null) {
			c.push({ key: 'lotSizeRange', label: `Lot: ${filters.lotSizeMin ?? '...'} - ${filters.lotSizeMax ?? '...'}` });
		}
		if (filters.pipsMin != null || filters.pipsMax != null) {
			c.push({ key: 'pipsRange', label: `Pips: ${filters.pipsMin ?? '...'} - ${filters.pipsMax ?? '...'}` });
		}
		if (filters.qualityScoreMin != null || filters.qualityScoreMax != null) {
			c.push({ key: 'qualityScoreRange', label: `คุณภาพ: ${filters.qualityScoreMin ?? '...'} - ${filters.qualityScoreMax ?? '...'}` });
		}
		if (filters.disciplineScoreMin != null || filters.disciplineScoreMax != null) {
			c.push({ key: 'disciplineScoreRange', label: `วินัย: ${filters.disciplineScoreMin ?? '...'} - ${filters.disciplineScoreMax ?? '...'}` });
		}
		if (filters.executionScoreMin != null || filters.executionScoreMax != null) {
			c.push({ key: 'executionScoreRange', label: `Execution: ${filters.executionScoreMin ?? '...'} - ${filters.executionScoreMax ?? '...'}` });
		}
		if (filters.confidenceMin != null || filters.confidenceMax != null) {
			c.push({ key: 'confidenceRange', label: `ความมั่นใจ: ${filters.confidenceMin ?? '...'} - ${filters.confidenceMax ?? '...'}` });
		}

		if (filters.followedPlan) c.push({ key: 'followedPlan', label: `ทำตามแผน: ${filters.followedPlan === 'yes' ? 'ใช่' : 'ไม่'}` });
		if (filters.hasBrokenRules) c.push({ key: 'hasBrokenRules', label: `กฎที่ฝ่าฝืน: ${filters.hasBrokenRules === 'yes' ? 'มี' : 'ไม่มี'}` });

		for (const d of filters.dayOfWeek) c.push({ key: 'dayOfWeek', value: String(d), label: `วัน: ${DOW_LABELS[d] || d}` });

		return c;
	});
</script>

{#if chips.length > 0}
	<div class="flex flex-wrap items-center gap-1.5" transition:slide={{ duration: 200 }} role="list" aria-label="ตัวกรองที่ใช้งาน">
		{#each chips as chip (chip.key + (chip.value || ''))}
			<span
				role="listitem"
				class="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 pl-2.5 pr-1 py-1 text-xs text-brand-primary"
			>
				<span>{chip.label}</span>
				<button
					type="button"
					onclick={() => onremove(chip.key, chip.value)}
					aria-label="ลบตัวกรอง: {chip.label}"
					class="w-5 h-5 flex items-center justify-center rounded-full hover:bg-brand-primary/20 text-brand-primary/70 hover:text-brand-primary"
				>
					&times;
				</button>
			</span>
		{/each}

		{#if chips.length >= 2}
			<button
				type="button"
				onclick={onclear}
				class="text-xs text-gray-400 hover:text-white ml-1 py-1"
			>
				ล้างทั้งหมด
			</button>
		{/if}
	</div>
{/if}
