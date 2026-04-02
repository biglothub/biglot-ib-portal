import { parsePortfolioFilters } from '$lib/portfolio';
import { getAccessiblePortfolioAccount } from '$lib/server/portfolioAccount';
import { buildReportExplorer, fetchPortfolioBaseData } from '$lib/server/portfolio';
import { rateLimit } from '$lib/server/rate-limit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:reports:${profile.id}`, 10, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getAccessiblePortfolioAccount(locals.supabase, {
		userId: profile.id,
		selectedAccountId: typeof locals.selectedAccountId === 'string' ? locals.selectedAccountId : null
	});
	if (!account) {
		return json({ analytics: null, filteredTrades: [] });
	}

	const filters = parsePortfolioFilters(url.searchParams);
	const { trades, dailyStats, journals } = await fetchPortfolioBaseData(
		locals.supabase,
		account.id,
		profile.id
	);

	const report = buildReportExplorer(trades, dailyStats, journals, filters);
	return json(report);
};
