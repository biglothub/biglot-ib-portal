export type UserRole = 'admin' | 'master_ib' | 'client';

export interface Profile {
	id: string;
	email: string;
	full_name: string;
	role: UserRole;
	avatar_url: string | null;
	phone: string | null;
	telegram_chat_id: string | null;
	is_active: boolean;
	created_at: string;
}

export interface MasterIB {
	id: string;
	user_id: string;
	ib_code: string;
	company_name: string | null;
	commission_rate: number;
	max_clients: number;
	is_active: boolean;
	created_at: string;
	// Joined
	profiles?: Profile;
	client_accounts?: ClientAccount[];
}

export interface ClientAccount {
	id: string;
	user_id: string | null;
	master_ib_id: string;
	client_name: string;
	client_email: string | null;
	client_phone: string | null;
	nickname: string | null;
	mt5_account_id: string;
	mt5_investor_password: string;
	mt5_server: string;
	status: 'pending' | 'approved' | 'rejected' | 'suspended';
	submitted_at: string;
	reviewed_at: string | null;
	reviewed_by: string | null;
	rejection_reason: string | null;
	mt5_validated: boolean;
	mt5_validation_error: string | null;
	last_validated_at: string | null;
	last_synced_at: string | null;
	sync_error: string | null;
	sync_count: number;
	created_at: string;
	// Joined
	master_ibs?: MasterIB;
}

export interface DailyStats {
	id: string;
	client_account_id: string;
	date: string;
	balance: number;
	equity: number;
	profit: number;
	floating_pl: number;
	margin_level: number | null;
	total_lots: number;
	win_rate: number | null;
	total_trades: number;
	profit_factor: number | null;
	rr_ratio: number | null;
	max_drawdown: number | null;
	peak_equity: number | null;
	avg_win: number | null;
	avg_loss: number | null;
	best_trade: number | null;
	worst_trade: number | null;
	win_rate_buy: number | null;
	win_rate_sell: number | null;
	max_consecutive_wins: number | null;
	max_consecutive_losses: number | null;
	session_asian_profit: number | null;
	session_london_profit: number | null;
	session_newyork_profit: number | null;
	trading_style: string | null;
	favorite_pair: string | null;
	avg_holding_time: string | null;
	equity_growth_percent: number;
	created_at: string;
}

export interface Trade {
	id: string;
	client_account_id: string;
	symbol: string;
	type: 'BUY' | 'SELL';
	lot_size: number;
	open_price: number;
	close_price: number;
	open_time: string;
	close_time: string;
	profit: number;
	sl: number | null;
	tp: number | null;
	position_id: number;
	pips: number | null;
	created_at: string;
}

export interface OpenPosition {
	id: string;
	client_account_id: string;
	position_id: number;
	symbol: string;
	type: 'BUY' | 'SELL';
	lot_size: number;
	open_price: number;
	open_time: string;
	current_price: number | null;
	current_profit: number | null;
	sl: number | null;
	tp: number | null;
	updated_at: string;
}

export interface EquitySnapshot {
	id: string;
	client_account_id: string;
	timestamp: string;
	balance: number;
	equity: number;
	floating_pl: number;
	margin_level: number | null;
}

export interface ApprovalLog {
	id: string;
	client_account_id: string;
	action: 'submitted' | 'approved' | 'rejected' | 'suspended' | 'reactivated' | 'resubmitted';
	performed_by: string;
	previous_status: string | null;
	new_status: string | null;
	reason: string | null;
	metadata: Record<string, unknown> | null;
	created_at: string;
	// Joined
	client_accounts?: ClientAccount;
	profiles?: Profile;
}

export interface Notification {
	id: string;
	user_id: string;
	type: string;
	title: string;
	body: string | null;
	is_read: boolean;
	metadata: Record<string, unknown> | null;
	created_at: string;
}
