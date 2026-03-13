import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session) {
		const role = locals.profile?.role;
		const redirectMap: Record<string, string> = {
			admin: '/admin',
			master_ib: '/ib',
			client: '/portfolio'
		};
		throw redirect(303, redirectMap[role || ''] || '/');
	}
	return {};
};
