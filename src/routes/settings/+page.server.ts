import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { clientAccount: null, notificationPrefs: null };
	}

	const userId = locals.user.id;

	// Load client account (MT5 info) and notification prefs in parallel
	const [accountResult, prefsResult] = await Promise.all([
		locals.supabase
			.from('client_accounts')
			.select('mt5_account_id, mt5_server, client_name, status, last_synced_at, sync_count, master_ibs(company_name)')
			.eq('user_id', userId)
			.eq('status', 'approved')
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle(),
		locals.supabase
			.from('user_notification_prefs')
			.select('push_enabled, daily_email_enabled, trade_alerts_enabled, weekly_recap_enabled')
			.eq('user_id', userId)
			.maybeSingle()
	]);

	return {
		clientAccount: accountResult.data ?? null,
		notificationPrefs: prefsResult.data ?? {
			push_enabled: false,
			daily_email_enabled: false,
			trade_alerts_enabled: false,
			weekly_recap_enabled: false
		}
	};
};
