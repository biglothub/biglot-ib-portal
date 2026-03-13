import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.profile?.role !== 'master_ib' && locals.profile?.role !== 'admin') {
		throw redirect(303, '/');
	}
};
