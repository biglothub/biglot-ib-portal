import { createSupabaseServiceClient } from '$lib/server/supabase';

interface GoldPrice {
	price: number;
	source: string;
	updatedAt: string;
}

// Module-level cache (60 seconds)
let cachedPrice: GoldPrice | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

export async function getXauusdPrice(): Promise<GoldPrice | null> {
	if (cachedPrice && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
		return cachedPrice;
	}

	const price = await fetchFromOpenPositions()
		?? await fetchFromRecentTrades()
		?? await fetchFromMetalsApi();

	if (price) {
		cachedPrice = price;
		cacheTimestamp = Date.now();
	}

	return price;
}

async function fetchFromOpenPositions(): Promise<GoldPrice | null> {
	try {
		const supabase = createSupabaseServiceClient();
		const { data } = await supabase
			.from('open_positions')
			.select('current_price, updated_at')
			.eq('symbol', 'XAUUSD')
			.order('updated_at', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (data?.current_price) {
			return {
				price: data.current_price,
				source: 'MT5',
				updatedAt: data.updated_at || new Date().toISOString()
			};
		}
	} catch (err) {
		console.error('[gold-price] open_positions query failed:', err instanceof Error ? err.message : err);
	}
	return null;
}

async function fetchFromRecentTrades(): Promise<GoldPrice | null> {
	try {
		const supabase = createSupabaseServiceClient();
		const since24h = new Date();
		since24h.setHours(since24h.getHours() - 24);

		const { data } = await supabase
			.from('trades')
			.select('close_price, close_time')
			.eq('symbol', 'XAUUSD')
			.gte('close_time', since24h.toISOString())
			.order('close_time', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (data?.close_price) {
			return {
				price: data.close_price,
				source: 'last trade',
				updatedAt: data.close_time || new Date().toISOString()
			};
		}
	} catch (err) {
		console.error('[gold-price] trades query failed:', err instanceof Error ? err.message : err);
	}
	return null;
}

async function fetchFromMetalsApi(): Promise<GoldPrice | null> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5_000);

		const res = await fetch('https://api.metals.live/v1/spot/gold', {
			signal: controller.signal
		});
		clearTimeout(timeout);

		if (!res.ok) return null;

		const data = await res.json();
		const spot = Array.isArray(data) ? data[0] : data;
		const price = spot?.price ?? spot?.gold;

		if (typeof price === 'number' && price > 0) {
			return {
				price,
				source: 'metals.live',
				updatedAt: new Date().toISOString()
			};
		}
	} catch (err) {
		console.error('[gold-price] metals.live API failed:', err instanceof Error ? err.message : err);
	}
	return null;
}
