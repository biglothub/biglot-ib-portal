import { json } from '@sveltejs/kit';
import { YOUTUBE_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

// In-memory cache shared across requests (per server process)
let lastScanTime = 0;
let cachedResult: { liveCoaches: LiveCoachResult[]; scannedAt: string } | null = null;
const SCAN_COOLDOWN = 90_000; // 90 seconds

interface LiveCoachResult {
	youtube_handle: string;
	name: string;
	isLive: boolean;
	videoId: string | null;
}

interface Coach {
	name: string;
	youtube_handle: string;
	youtube_channel_id: string;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const supabase = locals.supabase;

	// Test mode: return mock live data for the first active coach
	if (url.searchParams.has('test')) {
		const { data: coaches } = await supabase
			.from('coaches')
			.select('name, youtube_handle, youtube_channel_id')
			.eq('is_active', true)
			.order('sort_order', { ascending: true })
			.limit(2);

		const testCoaches = (coaches ?? []).slice(0, 2).map((c: Coach) => ({
			youtube_handle: c.youtube_handle,
			name: c.name,
			isLive: true,
			videoId: 'jfKfPfyJRdk'
		}));

		return json({ liveCoaches: testCoaches, scannedAt: new Date().toISOString(), cached: false });
	}

	const now = Date.now();

	// Return cached result if within cooldown
	if (cachedResult && now - lastScanTime < SCAN_COOLDOWN) {
		return json({ ...cachedResult, cached: true });
	}

	if (!YOUTUBE_API_KEY) {
		return json({ liveCoaches: [], scannedAt: new Date().toISOString(), cached: false, error: 'No YouTube API key configured' });
	}

	// Fetch active coaches from DB
	const { data: coaches } = await supabase
		.from('coaches')
		.select('name, youtube_handle, youtube_channel_id')
		.eq('is_active', true)
		.not('youtube_channel_id', 'is', null)
		.order('sort_order', { ascending: true });

	if (!coaches || coaches.length === 0) {
		return json({ liveCoaches: [], scannedAt: new Date().toISOString(), cached: false });
	}

	// Scan all coaches in parallel via YouTube Data API v3
	const results = await Promise.all(
		coaches.map(async (coach: Coach): Promise<LiveCoachResult> => {
			try {
				const params = new URLSearchParams({
					part: 'snippet',
					channelId: coach.youtube_channel_id,
					eventType: 'live',
					type: 'video',
					maxResults: '1',
					key: YOUTUBE_API_KEY
				});

				const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
				const data = await res.json();

				if (data.items?.length > 0) {
					return {
						youtube_handle: coach.youtube_handle,
						name: coach.name,
						isLive: true,
						videoId: data.items[0].id.videoId
					};
				}

				return { youtube_handle: coach.youtube_handle, name: coach.name, isLive: false, videoId: null };
			} catch {
				return { youtube_handle: coach.youtube_handle, name: coach.name, isLive: false, videoId: null };
			}
		})
	);

	const liveCoaches = results.filter((r) => r.isLive);

	cachedResult = { liveCoaches, scannedAt: new Date().toISOString() };
	lastScanTime = now;

	return json({ ...cachedResult, cached: false });
};
