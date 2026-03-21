import type { PageServerLoad } from './$types';

export interface SymbolSetting {
	symbol: string;
	default_tp_pips: number | null;
	default_sl_pips: number | null;
	commission: number | null;
}

export interface TradeSettings {
	timezone: string;
	default_tp_pips: number | null;
	default_sl_pips: number | null;
	symbol_settings: SymbolSetting[];
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { tradeSettings: null as TradeSettings | null };
	}

	const { data } = await locals.supabase
		.from('user_trade_settings')
		.select('timezone, default_tp_pips, default_sl_pips, symbol_settings')
		.eq('user_id', locals.user.id)
		.single();

	const tradeSettings: TradeSettings = data
		? {
				timezone: data.timezone ?? 'Asia/Bangkok',
				default_tp_pips: data.default_tp_pips,
				default_sl_pips: data.default_sl_pips,
				symbol_settings: (data.symbol_settings as SymbolSetting[]) ?? []
			}
		: {
				timezone: 'Asia/Bangkok',
				default_tp_pips: null,
				default_sl_pips: null,
				symbol_settings: []
			};

	return { tradeSettings };
};
