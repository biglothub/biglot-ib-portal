import { beforeEach, describe, expect, it } from 'vitest';
import { accountsCache } from '../server/layout-cache';
import { getAccessiblePortfolioAccount } from '../server/portfolioAccount';

type AccountRow = {
	id: string;
	client_name: string;
	mt5_account_id: string;
	mt5_server: string;
	status: string;
	last_synced_at: string | null;
};

function createSupabaseMock(responses: { approved: AccountRow[]; validated?: AccountRow[] }) {
	const calls: Array<{ type: 'approved' | 'validated'; ids?: string[] }> = [];

	const supabase = {
		from(table: string) {
			expect(table).toBe('client_accounts');

			const state: { ids?: string[] } = {};
			const builder = {
				select() {
					return builder;
				},
				eq() {
					return builder;
				},
				in(_field: string, ids: string[]) {
					state.ids = ids;
					return builder;
				},
				order() {
					if (state.ids) {
						calls.push({ type: 'validated', ids: state.ids });
						return Promise.resolve({ data: responses.validated ?? [] });
					}

					calls.push({ type: 'approved' });
					return Promise.resolve({ data: responses.approved });
				}
			};

			return builder;
		}
	};

	return { supabase, calls };
}

describe('getAccessiblePortfolioAccount', () => {
	beforeEach(() => {
		accountsCache.clear();
	});

	it('prefers the requested account over the selected account when both are accessible', async () => {
		const approved = [
			{ id: 'acc-1', client_name: 'One', mt5_account_id: '1', mt5_server: 'srv', status: 'approved', last_synced_at: null },
			{ id: 'acc-2', client_name: 'Two', mt5_account_id: '2', mt5_server: 'srv', status: 'approved', last_synced_at: null }
		];
		const { supabase, calls } = createSupabaseMock({ approved });

		const account = await getAccessiblePortfolioAccount(supabase as never, {
			userId: 'user-1',
			requestedAccountId: 'acc-2',
			selectedAccountId: 'acc-1'
		});

		expect(account?.id).toBe('acc-2');
		expect(calls).toHaveLength(1);
		expect(calls[0]?.type).toBe('approved');
	});

	it('falls back to the first approved account when the requested one is not owned by the user', async () => {
		const approved = [
			{ id: 'acc-1', client_name: 'One', mt5_account_id: '1', mt5_server: 'srv', status: 'approved', last_synced_at: null }
		];
		const { supabase, calls } = createSupabaseMock({ approved, validated: [] });

		const account = await getAccessiblePortfolioAccount(supabase as never, {
			userId: 'user-1',
			requestedAccountId: 'foreign-account',
			selectedAccountId: null
		});

		expect(account?.id).toBe('acc-1');
		expect(calls).toEqual([
			{ type: 'approved' },
			{ type: 'validated', ids: ['foreign-account'] }
		]);
	});
});
