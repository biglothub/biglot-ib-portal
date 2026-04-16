import { redirect } from '@sveltejs/kit';
import { getRoleRedirect, sanitizeReturnTo } from '$lib/server/mfa';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/auth/login');
	}

	if (!locals.needsMfa) {
		throw redirect(303, getRoleRedirect(locals.profile?.role));
	}

	return {
		returnTo: sanitizeReturnTo(url.searchParams.get('returnTo'), getRoleRedirect(locals.profile?.role))
	};
};
