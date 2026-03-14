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
		?? await fetchFromSwissquote();

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

async function fetchFromSwissquote(): Promise<GoldPrice | null> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5_000);

		const res = await fetch('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD', {
			signal: controller.signal
		});
		clearTimeout(timeout);

		if (!res.ok) return null;

		const data = await res.json();
		const quote = Array.isArray(data) ? data[0] : data;
		const spread = quote?.spreadProfilePrices?.[0];
		const bid = spread?.bid;
		const ask = spread?.ask;

		if (typeof bid === 'number' && typeof ask === 'number' && bid > 0) {
			return {
				price: (bid + ask) / 2,
				source: 'Swissquote',
				updatedAt: new Date().toISOString()
			};
		}
	} catch (err) {
		console.error('[gold-price] Swissquote API failed:', err instanceof Error ? err.message : err);
	}
	return null;
}
