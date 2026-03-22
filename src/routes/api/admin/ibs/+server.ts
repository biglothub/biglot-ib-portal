import { json } from '@sveltejs/kit';
import { AuthSetupError, createMasterIBUser } from '$lib/server/auth';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.profile?.role !== 'admin') {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!(await rateLimit(`admin:ibs:${ip}`, 10, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const { email, full_name, ib_code, company_name } = await request.json();

	if (!email || !full_name || !ib_code) {
		return json({ message: 'กรุณากรอก email, ชื่อ, และรหัส IB' }, { status: 400 });
	}

	try {
		const { user, tempPassword } = await createMasterIBUser({
			email,
			full_name,
			ib_code,
			company_name
		});

		return json({ success: true, userId: user.id, tempPassword });
	} catch (e: unknown) {
		if (e instanceof AuthSetupError) {
			return json({ message: e.message }, { status: e.status });
		}
		return json({ message: e instanceof Error ? e.message : 'ไม่สามารถสร้าง Master IB ได้' }, { status: 500 });
	}
};
