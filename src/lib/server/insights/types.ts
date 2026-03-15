export interface Trade {
	id: string;
	symbol: string;
	type: string; // BUY | SELL
	lot_size: number;
	open_price: number;
	close_price: number;
	profit: number;
	commission?: number;
	swap?: number;
	open_time: string;
	close_time: string;
	sl?: number;
	tp?: number;
	position_id?: string;
}

export interface TradeContext {
	/** All trades for this account (for computing averages) */
	allTrades: Trade[];
	/** Trades for the same symbol */
	symbolTrades: Trade[];
	/** Average profit for winning trades of this symbol */
	avgSymbolWin: number;
	/** Average profit for losing trades of this symbol */
	avgSymbolLoss: number;
	/** Average hold time in minutes for this symbol */
	avgSymbolHoldMinutes: number;
}

export interface InsightResult {
	ruleId: string;
	category: 'positive' | 'negative' | 'warning' | 'info';
	message: string;
	data: Record<string, unknown>;
}

export interface InsightRule {
	id: string;
	name: string;
	evaluate(trade: Trade, context: TradeContext): InsightResult | null;
}
