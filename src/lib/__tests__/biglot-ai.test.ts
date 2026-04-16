import { describe, expect, it } from 'vitest';
import {
	inferBigLotAiTitle,
	validateBigLotAiFeedbackBody,
	validateBigLotAiRunBody
} from '$lib/server/validation';

describe('TradePilot validation', () => {
	it('accepts a valid run payload and defaults chatId to null', () => {
		const result = validateBigLotAiRunBody({
			mode: 'portfolio',
			message: 'สรุปผลงาน 7 วันล่าสุดให้หน่อย'
		});

		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.chatId).toBeNull();
			expect(result.mode).toBe('portfolio');
		}
	});

	it('rejects invalid mode values', () => {
		const result = validateBigLotAiRunBody({
			mode: 'sql-agent',
			message: 'hello'
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.status).toBe(400);
		}
	});

	it('rejects empty messages', () => {
		const result = validateBigLotAiRunBody({
			mode: 'coach',
			message: '   '
		});

		expect(result.valid).toBe(false);
	});

	it('accepts valid feedback payloads', () => {
		const result = validateBigLotAiFeedbackBody({
			messageId: 'msg-123',
			runId: 'run-123',
			feedback: 'positive',
			reason: 'ช่วยสรุปได้ตรง'
		});

		expect(result.valid).toBe(true);
		if (result.valid) {
			expect(result.feedback).toBe('positive');
			expect(result.reason).toBe('ช่วยสรุปได้ตรง');
		}
	});

	it('rejects invalid feedback values', () => {
		const result = validateBigLotAiFeedbackBody({
			messageId: 'msg-123',
			feedback: 'neutral'
		});

		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.status).toBe(400);
		}
	});
});

describe('inferBigLotAiTitle', () => {
	it('falls back to TradePilot when empty', () => {
		expect(inferBigLotAiTitle('   ')).toBe('TradePilot');
	});

	it('truncates long messages for chat titles', () => {
		expect(inferBigLotAiTitle('ช่วยสรุป recurring mistakes จากการเทรดทั้งหมดของฉันในเดือนนี้และแนะนำ checklist ใหม่ให้ด้วย').length).toBeLessThanOrEqual(48);
	});
});
