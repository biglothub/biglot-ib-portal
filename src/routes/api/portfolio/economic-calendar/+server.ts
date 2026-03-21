import { json } from '@sveltejs/kit';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export interface EconomicEvent {
	id: string;
	title: string;
	country: string;
	date: string;
	time: string;
	impact: 'High' | 'Medium' | 'Low' | 'Holiday';
	forecast: string;
	previous: string;
	actual: string;
}

/**
 * GET /api/portfolio/economic-calendar
 *
 * Fetches economic calendar events from Forex Factory's public JSON feed.
 * Falls back to an empty array if the external API is unavailable.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'Forbidden' }, { status: 403 });
	}

	if (!rateLimit(`portfolio:economic-calendar:${profile.id}`, 10, 60_000)) {
		return json({ message: 'Too many requests' }, { status: 429 });
	}

	const week = url.searchParams.get('week') || 'thisweek';
	const validWeeks = ['thisweek', 'nextweek', 'lastweek'];
	const safeWeek = validWeeks.includes(week) ? week : 'thisweek';

	try {
		const response = await fetch(
			`https://nfs.faireconomy.media/ff_calendar_${safeWeek}.json`,
			{
				headers: { 'User-Agent': 'IBPortal/1.0' },
				signal: AbortSignal.timeout(8000)
			}
		);

		if (!response.ok) {
			return json({ events: [], source: 'unavailable' });
		}

		const rawEvents: any[] = await response.json();

		const events: EconomicEvent[] = rawEvents.map((e: any, i: number) => ({
			id: `${e.date}-${i}`,
			title: e.title || '',
			country: e.country || '',
			date: e.date || '',
			time: e.time || '',
			impact: mapImpact(e.impact),
			forecast: e.forecast || '',
			previous: e.previous || '',
			actual: e.actual || ''
		}));

		return json({ events, source: 'forex_factory' });
	} catch {
		return json({ events: [], source: 'error' });
	}
};

function mapImpact(impact: string): EconomicEvent['impact'] {
	if (!impact) return 'Low';
	const lower = impact.toLowerCase();
	if (lower === 'high' || lower === 'red') return 'High';
	if (lower === 'medium' || lower === 'orange' || lower === 'yellow') return 'Medium';
	if (lower === 'holiday') return 'Holiday';
	return 'Low';
}
