import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';

export interface OpenPositionRow {
	id?: string;
	client_account_id: string;
	position_id: number;
	symbol: string;
	type: 'BUY' | 'SELL';
	lot_size: number;
	open_price: number;
	open_time: string;
	current_price: number | null;
	current_profit: number;
	sl: number | null;
	tp: number | null;
	updated_at: string;
}

/**
 * Subscribe to live updates of open positions for a single client account.
 * Returns an unsubscribe function. The callback receives the current full list.
 *
 * Bridge writes equity_snapshots and trades on similar cadence — for those use
 * subscribeEquitySnapshots / subscribeTrades helpers instead.
 */
export function subscribeOpenPositions(
	accountId: string,
	initial: OpenPositionRow[],
	onChange: (positions: OpenPositionRow[]) => void
): () => void {
	let positions = [...initial];

	const apply = () => onChange([...positions]);

	const upsert = (row: OpenPositionRow) => {
		const idx = positions.findIndex((p) => p.position_id === row.position_id);
		if (idx >= 0) positions[idx] = row;
		else positions.push(row);
	};

	const remove = (row: Partial<OpenPositionRow>) => {
		positions = positions.filter((p) => p.position_id !== row.position_id);
	};

	const channel: RealtimeChannel = supabase
		.channel(`open_positions:${accountId}`)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'open_positions',
				filter: `client_account_id=eq.${accountId}`
			},
			(payload) => {
				if (payload.eventType === 'DELETE') {
					remove(payload.old as Partial<OpenPositionRow>);
				} else {
					upsert(payload.new as OpenPositionRow);
				}
				apply();
			}
		)
		.subscribe();

	return () => {
		void supabase.removeChannel(channel);
	};
}
