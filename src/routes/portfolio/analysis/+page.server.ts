import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const params = new URLSearchParams(url.searchParams);
	params.set('mode', 'gold');
	throw redirect(307, `/portfolio/ai?${params.toString()}`);
};
