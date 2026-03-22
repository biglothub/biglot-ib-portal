import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createSupabaseServiceClient();

	const { data: coaches } = await supabase
		.from('coaches')
		.select('*')
		.order('sort_order', { ascending: true });

	return {
		coaches: coaches ?? []
	};
};
