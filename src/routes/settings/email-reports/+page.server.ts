import type { PageServerLoad } from './$types';
import type { EmailReportSettings } from '../../api/portfolio/daily-report/+server';

export type { EmailReportSettings };

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			settings: {
				id: '',
				daily_enabled: false,
				daily_send_hour: 20,
				weekly_enabled: false,
				weekly_day: 0,
				last_daily_sent_at: null,
				last_weekly_sent_at: null
			} as EmailReportSettings
		};
	}

	const { data } = await locals.supabase
		.from('email_report_settings')
		.select(
			'id, daily_enabled, daily_send_hour, weekly_enabled, weekly_day, last_daily_sent_at, last_weekly_sent_at'
		)
		.eq('user_id', locals.user.id)
		.maybeSingle();

	const settings: EmailReportSettings = data ?? {
		id: '',
		daily_enabled: false,
		daily_send_hour: 20,
		weekly_enabled: false,
		weekly_day: 0,
		last_daily_sent_at: null,
		last_weekly_sent_at: null
	};

	return { settings };
};
