import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const ROLE_REDIRECT: Record<string, string> = {
	client: '/portfolio',
	master_ib: '/ib',
	admin: '/admin'
};

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		const role = locals.profile?.role ?? 'client';
		throw redirect(303, ROLE_REDIRECT[role] ?? '/portfolio');
	}
	return {};
};
