import { redirect } from '@sveltejs/kit';
import { getRoleRedirect } from '$lib/server/mfa';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		if (locals.needsMfa) {
			throw redirect(303, '/auth/mfa');
		}

		throw redirect(303, getRoleRedirect(locals.profile?.role));
	}

	return {
		error: url.searchParams.get('error')
	};
};
