import { json } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (locals.profile?.role !== 'admin') {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	const supabase = createSupabaseServiceClient();

	// Find the highest IB code that matches the IB### pattern
	const { data: ibs } = await supabase
		.from('master_ibs')
		.select('ib_code')
		.like('ib_code', 'IB%')
		.order('ib_code', { ascending: false });

	let nextNum = 1;

	if (ibs && ibs.length > 0) {
		for (const ib of ibs) {
			const match = ib.ib_code.match(/^IB(\d+)$/);
			if (match) {
				nextNum = parseInt(match[1], 10) + 1;
				break;
			}
		}
	}

	const nextCode = `IB${String(nextNum).padStart(3, '0')}`;

	return json({ nextCode });
};
