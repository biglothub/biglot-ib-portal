import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { clientAccount: null, notificationPrefs: null };
	}

	const userId = locals.user.id;

	// Load client account (MT5 info), notification prefs, and API keys in parallel
	const [accountResult, prefsResult, apiKeysResult] = await Promise.all([
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
			.select('push_enabled, daily_email_enabled, trade_alerts_enabled, weekly_recap_enabled, sync_status_enabled, risk_threshold_enabled, account_status_enabled, journal_reminder_enabled, ai_insight_enabled')
			.eq('user_id', userId)
			.maybeSingle(),
		locals.supabase
			.from('api_keys')
			.select('id, name, key_prefix, scopes, last_used_at, expires_at, is_active, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
	]);

	return {
		clientAccount: accountResult.data ?? null,
		notificationPrefs: prefsResult.data ?? {
			push_enabled: false,
			daily_email_enabled: false,
			trade_alerts_enabled: false,
			weekly_recap_enabled: false,
			sync_status_enabled: true,
			risk_threshold_enabled: true,
			account_status_enabled: true,
			journal_reminder_enabled: false,
			ai_insight_enabled: true
		},
		apiKeys: apiKeysResult.data ?? []
	};
};
