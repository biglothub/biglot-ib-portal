import { json, error } from '@sveltejs/kit';
import { createMasterIBUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.profile?.role !== 'admin') throw error(403, 'Forbidden');

	const { email, full_name, ib_code, company_name } = await request.json();

	if (!email || !full_name || !ib_code) {
		throw error(400, 'Missing required fields: email, full_name, ib_code');
	}

	try {
		const { user, tempPassword } = await createMasterIBUser({
			email,
			full_name,
			ib_code,
			company_name
		});

		return json({ success: true, userId: user.id, tempPassword });
	} catch (e: any) {
		throw error(500, e.message || 'Failed to create Master IB');
	}
};
