import { describe, it, expect } from 'vitest';
import {
	THAILAND_OFFSET_MS,
	formatCurrency,
	formatNumber,
	formatPercent,
	formatDate,
	formatDateTime,
	timeAgo,
	getStatusColor,
	getStatusBgColor,
	getStatusLabel,
	getBangkokToday,
	toThaiDateString
} from '../utils';

describe('THAILAND_OFFSET_MS', () => {
	it('should be 7 hours in milliseconds', () => {
		expect(THAILAND_OFFSET_MS).toBe(7 * 60 * 60 * 1000);
	});
});

describe('formatCurrency', () => {
	it('formats positive numbers as USD', () => {
		expect(formatCurrency(1234.56)).toBe('$1,234.56');
	});

	it('formats negative numbers', () => {
		expect(formatCurrency(-500)).toBe('-$500.00');
	});

	it('formats zero', () => {
		expect(formatCurrency(0)).toBe('$0.00');
	});

	it('returns dash for null', () => {
		expect(formatCurrency(null)).toBe('-');
	});

	it('returns dash for undefined', () => {
		expect(formatCurrency(undefined)).toBe('-');
	});

	it('respects custom decimals', () => {
		expect(formatCurrency(1234.5678, 0)).toBe('$1,235');
		expect(formatCurrency(1234.5678, 4)).toBe('$1,234.5678');
	});

	it('handles large numbers', () => {
		expect(formatCurrency(1000000)).toBe('$1,000,000.00');
	});
});

describe('formatNumber', () => {
	it('formats with default 2 decimals', () => {
		expect(formatNumber(1234.5678)).toBe('1,234.57');
	});

	it('returns dash for null/undefined', () => {
		expect(formatNumber(null)).toBe('-');
		expect(formatNumber(undefined)).toBe('-');
	});

	it('respects custom decimals', () => {
		expect(formatNumber(3.14159, 0)).toBe('3');
		expect(formatNumber(3.14159, 4)).toBe('3.1416');
	});
});

describe('formatPercent', () => {
	it('formats positive with + prefix', () => {
		expect(formatPercent(25.5)).toBe('+25.5%');
	});

	it('formats negative without + prefix', () => {
		expect(formatPercent(-10.3)).toBe('-10.3%');
	});

	it('formats zero with + prefix', () => {
		expect(formatPercent(0)).toBe('+0.0%');
	});

	it('returns dash for null/undefined', () => {
		expect(formatPercent(null)).toBe('-');
		expect(formatPercent(undefined)).toBe('-');
	});

	it('respects custom decimals', () => {
		expect(formatPercent(25.567, 2)).toBe('+25.57%');
	});
});

describe('formatDate', () => {
	it('returns dash for null/undefined/empty', () => {
		expect(formatDate(null)).toBe('-');
		expect(formatDate(undefined)).toBe('-');
		expect(formatDate('')).toBe('-');
	});

	it('formats a valid date string', () => {
		const result = formatDate('2026-01-15');
		expect(result).toBeTruthy();
		expect(result).not.toBe('-');
	});
});

describe('formatDateTime', () => {
	it('returns dash for null/undefined/empty', () => {
		expect(formatDateTime(null)).toBe('-');
		expect(formatDateTime(undefined)).toBe('-');
		expect(formatDateTime('')).toBe('-');
	});

	it('formats a valid datetime string', () => {
		const result = formatDateTime('2026-01-15T10:30:00Z');
		expect(result).toBeTruthy();
		expect(result).not.toBe('-');
	});
});

describe('timeAgo', () => {
	it('returns dash for null/undefined', () => {
		expect(timeAgo(null)).toBe('-');
		expect(timeAgo(undefined)).toBe('-');
	});

	it('returns Thai "just now" for recent times', () => {
		const now = new Date().toISOString();
		expect(timeAgo(now)).toBe('เมื่อสักครู่');
	});

	it('returns minutes ago in Thai', () => {
		const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
		expect(timeAgo(fiveMinAgo)).toBe('5 นาทีที่แล้ว');
	});

	it('returns hours ago in Thai', () => {
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString();
		expect(timeAgo(twoHoursAgo)).toBe('2 ชั่วโมงที่แล้ว');
	});

	it('returns days ago in Thai', () => {
		const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString();
		expect(timeAgo(threeDaysAgo)).toBe('3 วันที่แล้ว');
	});
});

describe('getStatusColor', () => {
	it('returns correct color for each status', () => {
		expect(getStatusColor('approved')).toBe('text-green-400');
		expect(getStatusColor('pending')).toBe('text-yellow-400');
		expect(getStatusColor('rejected')).toBe('text-red-400');
		expect(getStatusColor('suspended')).toBe('text-gray-400');
	});

	it('returns gray for unknown status', () => {
		expect(getStatusColor('unknown')).toBe('text-gray-400');
	});
});

describe('getStatusBgColor', () => {
	it('returns correct classes for each status', () => {
		expect(getStatusBgColor('approved')).toContain('bg-green');
		expect(getStatusBgColor('pending')).toContain('bg-yellow');
		expect(getStatusBgColor('rejected')).toContain('bg-red');
		expect(getStatusBgColor('suspended')).toContain('bg-gray');
	});
});

describe('getStatusLabel', () => {
	it('returns Thai labels for known statuses', () => {
		expect(getStatusLabel('approved')).toBe('อนุมัติ');
		expect(getStatusLabel('pending')).toBe('รออนุมัติ');
		expect(getStatusLabel('rejected')).toBe('ปฏิเสธ');
		expect(getStatusLabel('suspended')).toBe('ระงับ');
	});

	it('returns the input string for unknown status', () => {
		expect(getStatusLabel('custom')).toBe('custom');
	});
});

describe('getBangkokToday', () => {
	it('returns a valid YYYY-MM-DD string', () => {
		const result = getBangkokToday();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('toThaiDateString', () => {
	it('converts UTC midnight to Thai date', () => {
		const result = toThaiDateString('2026-01-15T00:00:00Z');
		// UTC midnight + 7h = still Jan 15 in Thailand
		expect(result).toBe('2026-01-15');
	});

	it('converts UTC late night to next Thai day', () => {
		// 20:00 UTC = 03:00 next day in Thailand
		const result = toThaiDateString('2026-01-15T20:00:00Z');
		expect(result).toBe('2026-01-16');
	});
});
