import { rateLimit } from '$lib/server/rate-limit';
import { getApprovedPortfolioAccount } from '$lib/server/portfolioAccount';
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

const MAX_IMPORT = 500;

const REQUIRED_FIELDS = ['symbol', 'type', 'lot_size', 'open_price', 'close_price', 'open_time', 'close_time', 'profit'] as const;

function parseCsvLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (i + 1 < line.length && line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += ch;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				result.push(current.trim());
				current = '';
			} else {
				current += ch;
			}
		}
	}
	result.push(current.trim());
	return result;
}

function normalizeHeader(h: string): string {
	return h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

const HEADER_ALIASES: Record<string, string> = {
	symbol: 'symbol',
	pair: 'symbol',
	instrument: 'symbol',
	type: 'type',
	side: 'type',
	direction: 'type',
	lot_size: 'lot_size',
	lots: 'lot_size',
	volume: 'lot_size',
	size: 'lot_size',
	open_price: 'open_price',
	entry_price: 'open_price',
	entry: 'open_price',
	close_price: 'close_price',
	exit_price: 'close_price',
	exit: 'close_price',
	open_time: 'open_time',
	entry_time: 'open_time',
	open_date: 'open_time',
	close_time: 'close_time',
	exit_time: 'close_time',
	close_date: 'close_time',
	profit: 'profit',
	pnl: 'profit',
	p_l: 'profit',
	net_profit: 'profit',
	pips: 'pips',
	commission: 'commission',
	swap: 'swap',
	sl: 'sl',
	stop_loss: 'sl',
	tp: 'tp',
	take_profit: 'tp',
	position_id: 'position_id',
	ticket: 'position_id',
	order: 'position_id',
	order_id: 'position_id'
};

function mapHeaders(csvHeaders: string[]): Record<number, string> {
	const mapping: Record<number, string> = {};
	for (let i = 0; i < csvHeaders.length; i++) {
		const normalized = normalizeHeader(csvHeaders[i]);
		const mapped = HEADER_ALIASES[normalized];
		if (mapped) {
			mapping[i] = mapped;
		}
	}
	return mapping;
}

function parseTradeRow(
	cells: string[],
	columnMap: Record<number, string>
): { trade: Record<string, any> | null; error: string | null } {
	const row: Record<string, any> = {};

	for (const [colIdx, field] of Object.entries(columnMap)) {
		const val = cells[Number(colIdx)] ?? '';
		row[field] = val;
	}

	// Validate required fields
	for (const field of REQUIRED_FIELDS) {
		if (!row[field] && row[field] !== 0) {
			return { trade: null, error: `Missing required field: ${field}` };
		}
	}

	// Parse types
	const type = row.type?.toUpperCase?.();
	if (type !== 'BUY' && type !== 'SELL') {
		return { trade: null, error: `Invalid type: ${row.type} (must be BUY or SELL)` };
	}

	const lotSize = parseFloat(row.lot_size);
	if (isNaN(lotSize) || lotSize <= 0) {
		return { trade: null, error: `Invalid lot_size: ${row.lot_size}` };
	}

	const openPrice = parseFloat(row.open_price);
	const closePrice = parseFloat(row.close_price);
	if (isNaN(openPrice) || isNaN(closePrice)) {
		return { trade: null, error: `Invalid price values` };
	}

	const profit = parseFloat(row.profit);
	if (isNaN(profit)) {
		return { trade: null, error: `Invalid profit: ${row.profit}` };
	}

	// Parse dates
	const openTime = new Date(row.open_time);
	const closeTime = new Date(row.close_time);
	if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) {
		return { trade: null, error: `Invalid date format` };
	}

	const trade: Record<string, any> = {
		symbol: row.symbol.toUpperCase(),
		type,
		lot_size: lotSize,
		open_price: openPrice,
		close_price: closePrice,
		open_time: openTime.toISOString(),
		close_time: closeTime.toISOString(),
		profit,
		pips: row.pips ? parseFloat(row.pips) || null : null,
		commission: row.commission ? parseFloat(row.commission) || 0 : 0,
		swap: row.swap ? parseFloat(row.swap) || 0 : 0,
		sl: row.sl ? parseFloat(row.sl) || null : null,
		tp: row.tp ? parseFloat(row.tp) || null : null,
		position_id: row.position_id ? parseInt(row.position_id) || 0 : 0
	};

	return { trade, error: null };
}

export const POST = async ({ request, locals }: RequestEvent) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:trades-import:${profile.id}`, 3, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const account = await getApprovedPortfolioAccount(locals.supabase);
	if (!account) {
		return json({ message: 'No approved account' }, { status: 404 });
	}

	let body: { csv: string; column_map?: Record<string, string>; filename?: string };
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Invalid request body' }, { status: 400 });
	}

	const { csv, column_map } = body;

	if (!csv || typeof csv !== 'string') {
		return json({ message: 'csv field is required (string)' }, { status: 400 });
	}

	// Parse CSV
	const lines = csv
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.split('\n')
		.filter((line) => line.trim());

	if (lines.length < 2) {
		return json({ message: 'CSV must have header + at least 1 data row' }, { status: 400 });
	}

	const headerCells = parseCsvLine(lines[0]);

	// Use provided column_map or auto-detect
	let columnMap: Record<number, string>;
	if (column_map && Object.keys(column_map).length > 0) {
		// column_map: { "0": "symbol", "1": "type", ... }
		columnMap = {};
		for (const [idx, field] of Object.entries(column_map)) {
			columnMap[Number(idx)] = field;
		}
	} else {
		columnMap = mapHeaders(headerCells);
	}

	// Verify required fields are mapped
	const mappedFields = new Set(Object.values(columnMap));
	const missingFields = REQUIRED_FIELDS.filter((f) => !mappedFields.has(f));
	if (missingFields.length > 0) {
		return json(
			{
				message: `Cannot map required columns: ${missingFields.join(', ')}`,
				detected_headers: headerCells,
				auto_mapping: columnMap
			},
			{ status: 400 }
		);
	}

	const dataLines = lines.slice(1);
	if (dataLines.length > MAX_IMPORT) {
		return json(
			{ message: `Cannot import more than ${MAX_IMPORT} trades at once` },
			{ status: 400 }
		);
	}

	// Parse rows
	const validTrades: Record<string, any>[] = [];
	const errors: { row: number; error: string }[] = [];

	for (let i = 0; i < dataLines.length; i++) {
		const cells = parseCsvLine(dataLines[i]);
		const { trade, error } = parseTradeRow(cells, columnMap);
		if (error) {
			errors.push({ row: i + 2, error }); // +2: 1-indexed + header
		} else if (trade) {
			trade.client_account_id = account.id;
			validTrades.push(trade);
		}
	}

	if (validTrades.length === 0) {
		return json(
			{
				message: 'No valid trades to import',
				errors: errors.slice(0, 20),
				total_rows: dataLines.length
			},
			{ status: 400 }
		);
	}

	// Insert trades
	const { data: inserted, error: insertError } = await locals.supabase
		.from('trades')
		.insert(validTrades)
		.select('id');

	if (insertError) {
		return json({ message: insertError.message }, { status: 500 });
	}

	const insertedCount = inserted?.length ?? 0;

	// Log import history
	await locals.supabase.from('trade_import_logs').insert({
		user_id: profile.id,
		client_account_id: account.id,
		filename: body.filename || 'csv_upload',
		total_rows: dataLines.length,
		imported_count: insertedCount,
		error_count: errors.length,
		errors_summary: errors.length > 0 ? JSON.stringify(errors.slice(0, 50)) : null,
		status: errors.length === 0 ? 'success' : 'partial'
	});

	return json({
		success: true,
		imported: insertedCount,
		errors: errors.slice(0, 20),
		total_rows: dataLines.length,
		skipped: errors.length
	});
};

// GET: import history or field info
export const GET = async ({ locals, url }: RequestEvent) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (url.searchParams.get('history') === '1') {
		const { data: history } = await locals.supabase
			.from('trade_import_logs')
			.select('id, filename, total_rows, imported_count, error_count, status, created_at')
			.eq('user_id', profile.id)
			.order('created_at', { ascending: false })
			.limit(20);

		return json({ history: history ?? [] });
	}

	return json({
		required_fields: [...REQUIRED_FIELDS],
		optional_fields: ['pips', 'commission', 'swap', 'sl', 'tp', 'position_id'],
		header_aliases: HEADER_ALIASES
	});
};
