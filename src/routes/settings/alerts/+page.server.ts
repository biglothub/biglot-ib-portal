import type { PageServerLoad } from './$types';
import type { PerformanceAlert } from '../../api/portfolio/alerts/+server';

export type { PerformanceAlert };

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { alerts: [] as PerformanceAlert[] };
	}

	const { data } = await locals.supabase
		.from('performance_alerts')
		.select('id, alert_type, threshold, enabled, last_triggered_at, created_at')
		.eq('user_id', locals.user.id)
		.order('created_at', { ascending: true });

	return { alerts: (data ?? []) as PerformanceAlert[] };
};
