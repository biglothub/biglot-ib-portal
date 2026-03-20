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
	sl?: number | null;
	tp?: number | null;
	position_id?: string | number | null;
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
	/** The trade immediately before this one (by open_time), for sequence rules */
	previousTrade?: Trade;
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

// --- Day-level insights ---

export interface DaySummary {
	date: string;
	trades: Trade[];
	totalPnl: number;
	winCount: number;
	lossCount: number;
}

export interface DayContext {
	/** All account trades for rolling averages */
	allTrades: Trade[];
	/** Last 60 days summaries for baselines */
	recentDays: DaySummary[];
}

export interface DayInsightResult {
	ruleId: string;
	category: 'positive' | 'negative' | 'warning' | 'info';
	message: string;
	data: Record<string, unknown>;
	date: string;
}

export interface DayInsightRule {
	id: string;
	name: string;
	evaluate(dayTrades: Trade[], context: DayContext): DayInsightResult | null;
}

// --- Execution metrics ---

export interface ExecutionMetrics {
	/** |open_price - SL| * lot_size */
	plannedRisk: number | null;
	/** |TP - open_price| * lot_size */
	plannedReward: number | null;
	/** profit / planned_risk */
	rMultiple: number | null;
	/** (profit / planned_reward) * 100 */
	executionEfficiency: number | null;
}
