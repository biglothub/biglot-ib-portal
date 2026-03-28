import { vi, describe, it, expect } from 'vitest';

// Mock SvelteKit's $env/dynamic/private so tests run without a real SvelteKit server.
// Key must be exactly 64 hex chars (32 bytes for AES-256).
const mockEnv = vi.hoisted(() => ({
	MT5_ENCRYPTION_KEY: 'deadbeef'.repeat(8) // 64 hex chars = 32 bytes
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import { encrypt, decrypt } from '../server/crypto';

// ─── encrypt ────────────────────────────────────────────────────────────────

describe('encrypt', () => {
	it('returns a non-empty base64 string', () => {
		const result = encrypt('hello');
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
		// valid base64 — no characters outside the base64 alphabet
		expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
	});

	it('produces different ciphertext for the same plaintext (random IV)', () => {
		const a = encrypt('same plaintext');
		const b = encrypt('same plaintext');
		expect(a).not.toBe(b);
	});

	it('produces different ciphertext for different plaintexts', () => {
		const a = encrypt('hello');
		const b = encrypt('world');
		expect(a).not.toBe(b);
	});
});

// ─── decrypt ────────────────────────────────────────────────────────────────

describe('decrypt', () => {
	it('round-trips a plain ASCII string', () => {
		const plaintext = 'hello world';
		expect(decrypt(encrypt(plaintext))).toBe(plaintext);
	});

	it('throws when decrypting an empty-string ciphertext (too short guard)', () => {
		// encrypt('') produces IV(12)+TAG(16)+0 = 28 bytes, which is < min 29 bytes
		// The decrypt guard intentionally rejects this
		expect(() => decrypt(encrypt(''))).toThrow('Invalid encrypted data: too short');
	});

	it('round-trips Thai characters', () => {
		const thai = 'ทดสอบการเข้ารหัส';
		expect(decrypt(encrypt(thai))).toBe(thai);
	});

	it('round-trips a long string (MT5 investor password)', () => {
		const long = 'A'.repeat(64);
		expect(decrypt(encrypt(long))).toBe(long);
	});

	it('round-trips a string with special characters', () => {
		const special = 'P@$$w0rd!#%^&*()_+-=[]{}|;:,.<>?';
		expect(decrypt(encrypt(special))).toBe(special);
	});

	it('throws on input that is too short to be valid ciphertext', () => {
		// Base64 of only 5 bytes — less than IV(12) + TAG(16) + 1 minimum
		const tooShort = Buffer.from([1, 2, 3, 4, 5]).toString('base64');
		expect(() => decrypt(tooShort)).toThrow();
	});

	it('throws on tampered ciphertext (GCM auth tag fails)', () => {
		const encrypted = encrypt('secret');
		const buf = Buffer.from(encrypted, 'base64');
		// Flip a byte in the ciphertext portion (after IV + TAG)
		buf[buf.length - 1] ^= 0xff;
		const tampered = buf.toString('base64');
		expect(() => decrypt(tampered)).toThrow();
	});

	it('throws on tampered auth tag', () => {
		const encrypted = encrypt('secret');
		const buf = Buffer.from(encrypted, 'base64');
		// Flip a byte in the auth tag (bytes 12..27)
		buf[14] ^= 0x01;
		const tampered = buf.toString('base64');
		expect(() => decrypt(tampered)).toThrow();
	});
});

// ─── Missing / invalid key ───────────────────────────────────────────────────

describe('getKey validation', () => {
	it('throws when MT5_ENCRYPTION_KEY is missing', () => {
		const original = mockEnv.MT5_ENCRYPTION_KEY;
		mockEnv.MT5_ENCRYPTION_KEY = undefined as any;
		expect(() => encrypt('test')).toThrow('MT5_ENCRYPTION_KEY');
		mockEnv.MT5_ENCRYPTION_KEY = original;
	});

	it('throws when MT5_ENCRYPTION_KEY is wrong length (not 32 bytes)', () => {
		const original = mockEnv.MT5_ENCRYPTION_KEY;
		mockEnv.MT5_ENCRYPTION_KEY = 'deadbeef'; // only 8 hex chars → 4 bytes
		expect(() => encrypt('test')).toThrow();
		mockEnv.MT5_ENCRYPTION_KEY = original;
	});
});
