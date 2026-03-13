import { createSupabaseServiceClient } from './supabase';
import crypto from 'crypto';
import { normalizeEmail, normalizeIbCode } from './clientAccounts';

export class AuthSetupError extends Error {
	constructor(
		message: string,
		public readonly status: number
	) {
		super(message);
	}
}

export async function createMasterIBUser(data: {
	email: string;
	full_name: string;
	ib_code: string;
	company_name?: string;
}) {
	const supabase = createSupabaseServiceClient();
	const email = normalizeEmail(data.email);
	const fullName = data.full_name.trim();
	const ibCode = normalizeIbCode(data.ib_code);
	const companyName = data.company_name?.trim() || null;

	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new AuthSetupError('Invalid email address', 400);
	}

	if (fullName.length < 2 || fullName.length > 100) {
		throw new AuthSetupError('Full name must be 2-100 characters', 400);
	}

	if (!/^[A-Z0-9_-]{2,50}$/.test(ibCode)) {
		throw new AuthSetupError('IB code must be 2-50 chars using A-Z, 0-9, _ or -', 400);
	}

	const tempPassword = crypto.randomBytes(8).toString('hex');

	const { data: authData, error: authError } = await supabase.auth.admin.createUser({
		email,
		password: tempPassword,
		email_confirm: true,
		user_metadata: { full_name: fullName, role: 'master_ib' }
	});

	if (authError) {
		const status = authError.message.toLowerCase().includes('already') ? 409 : 500;
		throw new AuthSetupError(authError.message, status);
	}

	const { error: ibError } = await supabase.from('master_ibs').insert({
		user_id: authData.user.id,
		ib_code: ibCode,
		company_name: companyName
	});

	if (ibError) {
		const { error: rollbackError } = await supabase.auth.admin.deleteUser(authData.user.id);
		if (rollbackError) {
			throw new AuthSetupError(
				`Failed to create Master IB and rollback auth user: ${rollbackError.message}`,
				500
			);
		}

		throw new AuthSetupError(ibError.message, ibError.code === '23505' ? 409 : 500);
	}

	return { user: authData.user, tempPassword };
}
