import crypto from 'crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
	const MT5_ENCRYPTION_KEY = env.MT5_ENCRYPTION_KEY;
	if (!MT5_ENCRYPTION_KEY) {
		throw new Error('MT5_ENCRYPTION_KEY environment variable is not set');
	}
	const key = Buffer.from(MT5_ENCRYPTION_KEY, 'hex');
	if (key.length !== 32) {
		throw new Error('MT5_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
	}
	return key;
}

export function encrypt(plaintext: string): string {
	const key = getKey();
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();

	// Format: base64(iv + tag + ciphertext)
	return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(encoded: string): string {
	const key = getKey();
	const combined = Buffer.from(encoded, 'base64');

	const iv = combined.subarray(0, IV_LENGTH);
	const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
	const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(tag);

	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
