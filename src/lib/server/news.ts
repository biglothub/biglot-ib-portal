import { env } from '$env/dynamic/private';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { XMLParser } from 'fast-xml-parser';
import OpenAI from 'openai';

const RSS_FEEDS = [
	{
		source: 'forexlive',
		url: 'https://www.forexlive.com/feed',
		titlePath: 'title',
		linkPath: 'link',
		descPath: 'description',
		datePath: 'pubDate'
	},
	{
		source: 'dailyfx',
		url: 'https://www.dailyfx.com/feeds/market-news',
		titlePath: 'title',
		linkPath: 'link',
		descPath: 'description',
		datePath: 'pubDate'
	},
	{
		source: 'investing_com',
		url: 'https://www.investing.com/rss/news_301.rss',
		titlePath: 'title',
		linkPath: 'link',
		descPath: 'description',
		datePath: 'pubDate'
	},
	{
		source: 'fxstreet',
		url: 'https://www.fxstreet.com/rss',
		titlePath: 'title',
		linkPath: 'link',
		descPath: 'description',
		datePath: 'pubDate'
	}
];

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_'
});

interface RawArticle {
	source: string;
	source_url: string;
	title_original: string;
	summary_original: string;
	published_at: string;
	image_url: string | null;
}

interface RawArticleNullable extends Omit<RawArticle, 'published_at'> {
	published_at: string | null;
}

// Module-level TTL tracking
let lastRefreshAt = 0;
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function canRefresh(): boolean {
	return Date.now() - lastRefreshAt >= REFRESH_COOLDOWN_MS;
}

export async function refreshNews(): Promise<{ success: boolean; newArticles: number }> {
	if (!canRefresh()) {
		return { success: true, newArticles: 0 };
	}

	lastRefreshAt = Date.now();
	const serviceClient = createSupabaseServiceClient();

	// 1. Fetch all RSS feeds in parallel
	const rawArticles = await fetchAllFeeds();

	if (rawArticles.length === 0) {
		return { success: true, newArticles: 0 };
	}

	// 2. Upsert raw articles
	const { data: inserted } = await serviceClient
		.from('market_news')
		.upsert(
			rawArticles.map((a) => ({
				source: a.source,
				source_url: a.source_url,
				title_original: a.title_original,
				summary_original: a.summary_original,
				published_at: a.published_at,
				image_url: a.image_url,
				ai_processed: false
			})),
			{ onConflict: 'source,source_url', ignoreDuplicates: true }
		)
		.select('id');

	// 3. Process unprocessed articles with AI
	const { data: unprocessed } = await serviceClient
		.from('market_news')
		.select('id, title_original, summary_original')
		.eq('ai_processed', false)
		.order('published_at', { ascending: false })
		.limit(15);

	let processedCount = 0;

	if (unprocessed && unprocessed.length > 0) {
		processedCount = await processWithAI(serviceClient, unprocessed);
	}

	// 4. Cleanup old news
	await serviceClient.rpc('cleanup_old_news');

	return { success: true, newArticles: processedCount };
}

async function fetchAllFeeds(): Promise<RawArticle[]> {
	const results = await Promise.allSettled(
		RSS_FEEDS.map((feed) => fetchSingleFeed(feed))
	);

	const articles: RawArticle[] = [];
	let failedCount = 0;
	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		if (result.status === 'fulfilled') {
			articles.push(...result.value);
		} else {
			failedCount++;
			console.error(`[news] Feed ${RSS_FEEDS[i].source} rejected:`, result.reason);
		}
	}

	if (failedCount > 0) {
		console.error(`[news] ${failedCount}/${RSS_FEEDS.length} feeds failed`);
	}

	return articles;
}

async function fetchSingleFeed(feed: (typeof RSS_FEEDS)[0]): Promise<RawArticle[]> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);

	try {
		const response = await fetch(feed.url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; IBPortalBot/1.0)',
				Accept: 'application/rss+xml, application/xml, text/xml'
			}
		});

		if (!response.ok) {
			console.error(`[news] RSS feed ${feed.source} returned HTTP ${response.status}`);
			return [];
		}

		const xml = await response.text();
		const parsed = xmlParser.parse(xml);

		// Handle both RSS 2.0 and Atom formats
		const items =
			parsed?.rss?.channel?.item ||
			parsed?.feed?.entry ||
			[];

		const itemList = Array.isArray(items) ? items : [items];

		return itemList
			.slice(0, 10) // Max 10 per feed
			.map((item: any) => {
				const title = item[feed.titlePath] || '';
				const link =
					typeof item[feed.linkPath] === 'string'
						? item[feed.linkPath]
						: item[feed.linkPath]?.['@_href'] || '';
				const desc = item[feed.descPath] || '';
				const dateStr = item[feed.datePath] || item.updated || '';

				// Try to extract image from description or media
				const imageUrl =
					item['media:content']?.['@_url'] ||
					item['media:thumbnail']?.['@_url'] ||
					item.enclosure?.['@_url'] ||
					null;

				// Strip HTML from description
				const cleanDesc = typeof desc === 'string'
					? desc.replace(/<[^>]*>/g, '').trim().slice(0, 500)
					: '';

				if (!title || !link) return null;

				return {
					source: feed.source,
					source_url: link,
					title_original: typeof title === 'string' ? title.trim() : String(title),
					summary_original: cleanDesc,
					published_at: parseDate(dateStr),
					image_url: typeof imageUrl === 'string' ? imageUrl : null
				};
			})
			.filter((a: RawArticleNullable | null): a is RawArticle => a !== null && a.published_at !== null);
	} catch (err) {
		console.error(`[news] RSS fetch failed for ${feed.source}:`, err instanceof Error ? err.message : err);
		return [];
	} finally {
		clearTimeout(timeout);
	}
}

function parseDate(dateStr: string): string | null {
	if (!dateStr) return null;
	try {
		const d = new Date(dateStr);
		return isNaN(d.getTime()) ? null : d.toISOString();
	} catch {
		return null;
	}
}

async function processWithAI(
	serviceClient: ReturnType<typeof createSupabaseServiceClient>,
	articles: { id: string; title_original: string; summary_original: string }[]
): Promise<number> {
	const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

	const articleList = articles
		.map(
			(a, i) =>
				`[${i}] Title: ${a.title_original}\nSummary: ${a.summary_original || 'N/A'}`
		)
		.join('\n\n');

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			max_tokens: 2048,
			response_format: { type: 'json_object' },
			messages: [
				{
					role: 'system',
					content: `คุณเป็นนักวิเคราะห์ข่าวการเงินที่แปลและสรุปข่าวสำหรับเทรดเดอร์ forex/commodities ชาวไทย

สำหรับแต่ละบทความ ให้:
1. แปลหัวข้อเป็นภาษาไทยที่กระชับ
2. สรุปเนื้อหาเป็นภาษาไทย 1-2 ประโยค เน้นผลกระทบต่อตลาด
3. จัดหมวดหมู่: forex, commodities, central_bank, economic_data, geopolitical, general
4. ระบุ symbols ที่เกี่ยวข้อง เช่น XAUUSD, EURUSD, USDJPY, GBPUSD, Oil, DXY
5. ให้คะแนนความเกี่ยวข้องกับเทรดเดอร์ forex/commodities (0-100)

ตอบเป็น JSON: { "results": [{ "index": 0, "title_th": "...", "summary_th": "...", "category": "...", "symbols": [...], "relevance_score": 75 }] }`
				},
				{
					role: 'user',
					content: articleList
				}
			]
		});

		const content = response.choices[0]?.message?.content;
		if (!content) return 0;

		const parsed = JSON.parse(content);
		const results = parsed.results || [];

		let updated = 0;

		for (const result of results) {
			const article = articles[result.index];
			if (!article) continue;

			const validCategories = ['forex', 'commodities', 'central_bank', 'economic_data', 'geopolitical', 'general'];
			const category = validCategories.includes(result.category) ? result.category : 'general';

			const { error } = await serviceClient
				.from('market_news')
				.update({
					title_th: result.title_th || '',
					summary_th: result.summary_th || '',
					category,
					symbols: Array.isArray(result.symbols) ? result.symbols : [],
					relevance_score: Math.min(100, Math.max(0, result.relevance_score || 50)),
					ai_processed: true
				})
				.eq('id', article.id);

			if (!error) updated++;
		}

		return updated;
	} catch {
		return 0;
	}
}
