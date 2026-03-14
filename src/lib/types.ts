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
	updated_at: string;
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
	commission: number;
	swap: number;
	created_at: string;
	// Joined
	trade_tag_assignments?: TradeTagAssignment[];
	trade_notes?: TradeNote[];
	trade_reviews?: TradeReview[];
	trade_attachments?: TradeAttachment[];
}

export type TagCategory =
	| 'setup'
	| 'execution'
	| 'emotion'
	| 'mistake'
	| 'market_condition'
	| 'custom';

export interface TradeTag {
	id: string;
	user_id: string;
	name: string;
	category: TagCategory;
	color: string;
	created_at: string;
}

export interface TradeTagAssignment {
	id: string;
	trade_id: string;
	tag_id: string;
	created_at: string;
	// Joined
	trade_tags?: TradeTag;
}

export interface TradeNote {
	id: string;
	trade_id: string;
	user_id: string;
	content: string;
	rating: number | null;
	created_at: string;
	updated_at: string;
}

export type ReviewStatus = 'unreviewed' | 'in_progress' | 'reviewed';

export interface TradeReview {
	id: string;
	trade_id: string;
	user_id: string;
	playbook_id: string | null;
	review_status: ReviewStatus;
	entry_reason: string;
	exit_reason: string;
	execution_notes: string;
	risk_notes: string;
	mistake_summary: string;
	lesson_summary: string;
	next_action: string;
	setup_quality_score: number | null;
	discipline_score: number | null;
	execution_score: number | null;
	confidence_at_entry: number | null;
	followed_plan: boolean | null;
	broken_rules: string[];
	reviewed_at: string | null;
	created_at: string;
	updated_at: string;
	// Joined
	playbooks?: Playbook | null;
}

export type TradeAttachmentKind = 'link' | 'image_url';

export interface TradeAttachment {
	id: string;
	trade_id: string;
	user_id: string;
	kind: TradeAttachmentKind;
	storage_path: string;
	caption: string;
	sort_order: number;
	created_at: string;
}

export interface Playbook {
	id: string;
	user_id: string;
	client_account_id: string;
	name: string;
	description: string;
	setup_tag_id: string | null;
	entry_criteria: string[];
	exit_criteria: string[];
	risk_rules: string[];
	mistakes_to_avoid: string[];
	example_trade_ids: string[];
	is_active: boolean;
	sort_order: number;
	created_at: string;
	updated_at: string;
	// Joined
	trade_tags?: TradeTag | null;
}

export interface ProgressGoal {
	id: string;
	user_id: string;
	client_account_id: string;
	goal_type:
		| 'review_completion'
		| 'journal_streak'
		| 'max_rule_breaks'
		| 'profit_factor'
		| 'win_rate';
	target_value: number;
	period_days: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface DailyJournal {
	id: string;
	user_id: string;
	client_account_id: string;
	date: string;
	pre_market_notes: string;
	post_market_notes: string;
	session_plan: string;
	market_bias: string;
	key_levels: string;
	checklist: string[];
	mood: number | null;
	energy_score: number | null;
	discipline_score: number | null;
	confidence_score: number | null;
	lessons: string;
	tomorrow_focus: string;
	completion_status: 'not_started' | 'in_progress' | 'complete';
	created_at: string;
	updated_at: string;
}

export interface PortfolioSavedView {
	id: string;
	user_id: string;
	client_account_id: string;
	page: 'trades' | 'analytics';
	name: string;
	filters: PortfolioFilterState;
	created_at: string;
	updated_at: string;
}

export interface TradeChartBar {
	time: number;
	open: number;
	high: number;
	low: number;
	close: number;
}

export interface TradeChartContext {
	id: string;
	trade_id: string;
	symbol: string;
	timeframe: string;
	window_start: string;
	window_end: string;
	bars: TradeChartBar[];
	created_at: string;
	updated_at: string;
}

export interface PortfolioFilterState {
	q: string;
	from: string;
	to: string;
	symbols: string[];
	sessions: string[];
	directions: string[];
	tagIds: string[];
	playbookIds: string[];
	reviewStatus: ReviewStatus[];
	outcome: '' | 'win' | 'loss' | 'breakeven';
	hasNotes: boolean | null;
	hasAttachments: boolean | null;
	durationBucket: '' | 'scalp' | 'intraday' | 'swing' | 'position';
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
	action: 'submitted' | 'approved' | 'rejected' | 'suspended' | 'reactivated' | 'resubmitted' | 'auto_unlinked';
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
