import { browser } from '$app/environment';

export interface DashboardWidget {
	id: string;
	label: string;
	visible: boolean;
	order: number;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
	{ id: 'primary_kpis', label: 'KPI หลัก (P&L, Win Rate, Profit Factor, Day Win%)', visible: true, order: 0 },
	{ id: 'secondary_kpis', label: 'KPI รอง (ยอดเงิน, มูลค่า, ค่าเฉลี่ย, ค่าคาดหวัง)', visible: true, order: 1 },
	{ id: 'equity_chart', label: 'กราฟ Equity', visible: true, order: 2 },
	{ id: 'cumulative_pnl', label: 'กราฟ Cumulative P&L', visible: true, order: 3 },
	{ id: 'daily_pnl', label: 'กราฟ Daily P&L', visible: true, order: 4 },
	{ id: 'health_radar', label: 'Health Score & Radar', visible: true, order: 5 },
	{ id: 'command_center', label: 'สิ่งที่ต้องดูแล', visible: true, order: 6 },
	{ id: 'review_queue', label: 'คิวรีวิว', visible: true, order: 7 },
	{ id: 'rule_breaks', label: 'ต้นทุนความผิดพลาด', visible: true, order: 8 },
	{ id: 'setup_performance', label: 'ผลงาน Setup', visible: true, order: 9 },
	{ id: 'open_positions', label: 'ออเดอร์ที่เปิดอยู่', visible: true, order: 10 },
	{ id: 'mini_calendar', label: 'ปฏิทินเทรด', visible: true, order: 11 },
	{ id: 'ai_coach', label: 'AI Coach', visible: true, order: 12 },
	{ id: 'risk_calculator', label: 'คำนวณความเสี่ยง', visible: true, order: 13 },
	{ id: 'sync_status', label: 'สถานะ Sync', visible: true, order: 14 },
	{ id: 'recent_trades', label: 'เทรดล่าสุด', visible: true, order: 15 },
];

let widgets = $state<DashboardWidget[]>([...DEFAULT_WIDGETS]);
let loaded = $state(false);
let saving = $state(false);
let saveError = $state<string | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function mergeWithDefaults(saved: DashboardWidget[]): DashboardWidget[] {
	const savedMap = new Map(saved.map(w => [w.id, w]));
	const merged: DashboardWidget[] = [];

	// Include all defaults, applying saved visibility/order if available
	for (const def of DEFAULT_WIDGETS) {
		const s = savedMap.get(def.id);
		if (s) {
			merged.push({ ...def, visible: s.visible, order: s.order });
		} else {
			merged.push({ ...def });
		}
	}

	// Sort by order
	merged.sort((a, b) => a.order - b.order);
	// Re-normalize order to 0..n-1
	merged.forEach((w, i) => w.order = i);
	return merged;
}

async function loadLayout(userId: string): Promise<void> {
	if (!browser) return;
	try {
		const res = await fetch('/api/portfolio/dashboard-layout');
		if (res.ok) {
			const data = await res.json();
			if (data.layout && Array.isArray(data.layout) && data.layout.length > 0) {
				widgets = mergeWithDefaults(data.layout);
			} else {
				widgets = [...DEFAULT_WIDGETS];
			}
		}
	} catch {
		// Keep defaults on error
	}
	loaded = true;
}

function scheduleSave(): void {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		void saveLayout();
	}, 1000);
}

async function saveLayout(): Promise<void> {
	if (!browser) return;
	saving = true;
	saveError = null;
	try {
		const res = await fetch('/api/portfolio/dashboard-layout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ layout: widgets }),
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			saveError = body.message || 'บันทึกไม่สำเร็จ';
		}
	} catch {
		saveError = 'ไม่สามารถเชื่อมต่อได้';
	} finally {
		saving = false;
	}
}

function toggleWidget(id: string): void {
	const idx = widgets.findIndex(w => w.id === id);
	if (idx === -1) return;
	widgets[idx] = { ...widgets[idx], visible: !widgets[idx].visible };
	scheduleSave();
}

function moveWidget(id: string, direction: 'up' | 'down'): void {
	const idx = widgets.findIndex(w => w.id === id);
	if (idx === -1) return;
	const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
	if (swapIdx < 0 || swapIdx >= widgets.length) return;

	// Swap orders
	const temp = widgets[idx].order;
	widgets[idx] = { ...widgets[idx], order: widgets[swapIdx].order };
	widgets[swapIdx] = { ...widgets[swapIdx], order: temp };

	// Re-sort the array
	const sorted = [...widgets].sort((a, b) => a.order - b.order);
	sorted.forEach((w, i) => w.order = i);
	widgets = sorted;
	scheduleSave();
}

function resetLayout(): void {
	widgets = DEFAULT_WIDGETS.map(w => ({ ...w }));
	scheduleSave();
}

function isVisible(id: string): boolean {
	const w = widgets.find(w => w.id === id);
	return w ? w.visible : true;
}

export const dashboardLayout = {
	get widgets() { return widgets; },
	get loaded() { return loaded; },
	get saving() { return saving; },
	get saveError() { return saveError; },
	loadLayout,
	toggleWidget,
	moveWidget,
	resetLayout,
	isVisible,
	saveLayout,
};
