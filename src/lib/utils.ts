/** UTC+7 offset in milliseconds (Thailand timezone) */
export const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Convert a UTC date string to a Thai-local YYYY-MM-DD string */
export function toThaiDateString(utcDateStr: string): string {
	return new Date(new Date(utcDateStr).getTime() + THAILAND_OFFSET_MS)
		.toISOString()
		.split('T')[0];
}

export function formatCurrency(value: number | null | undefined, decimals = 2): string {
	if (value == null) return '-';
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
	if (value == null) return '-';
	return new Intl.NumberFormat('en-US', {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
	if (value == null) return '-';
	return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatDate(dateStr: string | null | undefined): string {
	if (!dateStr) return '-';
	return new Date(dateStr).toLocaleDateString('th-TH', {
		day: 'numeric',
		month: 'short',
		year: '2-digit'
	});
}

export function formatDateTime(dateStr: string | null | undefined): string {
	if (!dateStr) return '-';
	return new Date(dateStr).toLocaleString('th-TH', {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
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
