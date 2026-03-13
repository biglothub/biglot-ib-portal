/**
 * One-time migration: encrypt existing plain-text MT5 investor passwords.
 *
 * Usage:
 *   npx tsx scripts/encrypt-existing-passwords.ts
 *
 * Required env vars:
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   MT5_ENCRYPTION_KEY  (64 hex chars)
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENCRYPTION_KEY = process.env.MT5_ENCRYPTION_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY || !ENCRYPTION_KEY) {
	console.error('Missing required env vars: PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MT5_ENCRYPTION_KEY');
	process.exit(1);
}

const key = Buffer.from(ENCRYPTION_KEY, 'hex');
if (key.length !== 32) {
	console.error('MT5_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
	process.exit(1);
}

function encrypt(plaintext: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function looksEncrypted(value: string): boolean {
	try {
		const buf = Buffer.from(value, 'base64');
		// Encrypted values: 12 IV + 16 tag + at least 4 bytes ciphertext = 32+ bytes
		// and the base64 round-trips cleanly
		return buf.length >= 32 && buf.toString('base64') === value;
	} catch {
		return false;
	}
}

async function main() {
	const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	const { data: accounts, error } = await supabase
		.from('client_accounts')
		.select('id, mt5_investor_password');

	if (error) {
		console.error('Failed to fetch accounts:', error.message);
		process.exit(1);
	}

	if (!accounts || accounts.length === 0) {
		console.log('No accounts found.');
		return;
	}

	let encrypted = 0;
	let skipped = 0;

	for (const account of accounts) {
		if (looksEncrypted(account.mt5_investor_password)) {
			skipped++;
			continue;
		}

		const encryptedPassword = encrypt(account.mt5_investor_password);
		const { error: updateError } = await supabase
			.from('client_accounts')
			.update({ mt5_investor_password: encryptedPassword })
			.eq('id', account.id);

		if (updateError) {
			console.error(`Failed to update account ${account.id}:`, updateError.message);
		} else {
			encrypted++;
		}
	}

	console.log(`Done. Encrypted: ${encrypted}, Skipped (already encrypted): ${skipped}`);
}

main();
