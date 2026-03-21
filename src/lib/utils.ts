/** UTC+7 offset in milliseconds (Thailand timezone) */
export const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Get today's date as YYYY-MM-DD in Bangkok timezone (UTC+7) */
export function getBangkokToday(): string {
	return new Date(Date.now() + THAILAND_OFFSET_MS).toISOString().split('T')[0];
}

/** Convert a UTC date string to a Thai-local YYYY-MM-DD string */
export function toThaiDateString(utcDateStr: string): string {
	return new Date(new Date(utcDateStr).getTime() + THAILAND_OFFSET_MS)
		.toISOString()
		.split('T')[0];
}

// Module-level formatter caches — avoid creating Intl objects on every call
const currencyFormatters = new Map<number, Intl.NumberFormat>();
const numberFormatters = new Map<number, Intl.NumberFormat>();

function getCurrencyFormatter(decimals: number): Intl.NumberFormat {
	let fmt = currencyFormatters.get(decimals);
	if (!fmt) {
		fmt = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
		currencyFormatters.set(decimals, fmt);
	}
	return fmt;
}

function getNumberFormatter(decimals: number): Intl.NumberFormat {
	let fmt = numberFormatters.get(decimals);
	if (!fmt) {
		fmt = new Intl.NumberFormat('en-US', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
		numberFormatters.set(decimals, fmt);
	}
	return fmt;
}

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
	day: 'numeric',
	month: 'short',
	year: '2-digit'
});

const dateTimeFormatter = new Intl.DateTimeFormat('th-TH', {
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit'
});

export function formatCurrency(value: number | null | undefined, decimals = 2): string {
	if (value == null) return '-';
	return getCurrencyFormatter(decimals).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
	if (value == null) return '-';
	return getNumberFormatter(decimals).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
	if (value == null) return '-';
	return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '-';
	return dateFormatter.format(new Date(dateStr));
}

export function formatDateTime(dateStr: string | null | undefined): string {
	if (!dateStr) return '-';
	return dateTimeFormatter.format(new Date(dateStr));
}

export function timeAgo(dateStr: string | null | undefined): string {
	if (!dateStr) return '-';
	const now = Date.now();
	const then = new Date(dateStr).getTime();
	const diff = now - then;

	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return 'เมื่อสักครู่';
	if (minutes < 60) return `${minutes} นาทีที่แล้ว`;

	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;

	const days = Math.floor(hours / 24);
	if (days < 30) return `${days} วันที่แล้ว`;

	return formatDate(dateStr);
}

/**
 * Format a P&L value according to the active display unit.
 * - 'usd'  → formatCurrency (default)
 * - 'pct'  → value / balance * 100, shown as "±X.XX%"
 * - 'pips' → value * 10, shown as "±X.X p"  (rough approximation: 1 USD ≈ 10 pips)
 *
 * Falls back to formatCurrency when balance is required but unavailable.
 */
export function formatPnl(
	value: number | null | undefined,
	unit: import('./stores/displayUnit').DisplayUnit,
	balance?: number | null
): string {
	if (value == null) return '-';
	if (unit === 'pct') {
		if (!balance) return formatCurrency(value);
		const pct = (value / balance) * 100;
		return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
	}
	if (unit === 'pips') {
		const pips = value * 10;
		return `${pips >= 0 ? '+' : ''}${pips.toFixed(1)} p`;
	}
	return formatCurrency(value);
}

export function getStatusColor(status: string): string {
	switch (status) {
		case 'approved': return 'text-green-400';
		case 'pending': return 'text-yellow-400';
		case 'rejected': return 'text-red-400';
		case 'suspended': return 'text-gray-400';
		default: return 'text-gray-400';
	}
}

export function getStatusBgColor(status: string): string {
	switch (status) {
		case 'approved': return 'bg-green-500/10 text-green-400 border-green-500/20';
		case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
		case 'rejected': return 'bg-red-500/10 text-red-400 border-red-500/20';
		case 'suspended': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
		default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
	}
}

export function getStatusLabel(status: string): string {
	switch (status) {
		case 'approved': return 'อนุมัติ';
		case 'pending': return 'รออนุมัติ';
		case 'rejected': return 'ปฏิเสธ';
		case 'suspended': return 'ระงับ';
		default: return status;
	}
}
