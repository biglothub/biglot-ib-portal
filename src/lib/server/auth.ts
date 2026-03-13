import { createSupabaseServiceClient } from './supabase';
import crypto from 'crypto';

export async function createMasterIBUser(data: {
	email: string;
	full_name: string;
	ib_code: string;
	company_name?: string;
}) {
	const supabase = createSupabaseServiceClient();
	const tempPassword = crypto.randomBytes(8).toString('hex');

	const { data: authData, error: authError } = await supabase.auth.admin.createUser({
		email: data.email,
		password: tempPassword,
		email_confirm: true,
		user_metadata: { full_name: data.full_name, role: 'master_ib' }
	});

	if (authError) throw authError;

	const { error: ibError } = await supabase.from('master_ibs').insert({
		user_id: authData.user.id,
		ib_code: data.ib_code,
		company_name: data.company_name || null
	});

	if (ibError) throw ibError;

	return { user: authData.user, tempPassword };
}

