import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		session: locals.session,
		profile: locals.profile,
		vapidPublicKey: env.VAPID_PUBLIC_KEY || ''
	};
};
