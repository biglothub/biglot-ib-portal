import { describe, expect, it } from 'vitest';
import { TRADEPILOT_MODE_OPTIONS, TRADEPILOT_STARTER_PROMPTS, filterTradePilotChats } from '$lib/tradepilot';
import type { BigLotAiChat } from '$lib/types';

describe('TradePilot config', () => {
	it('covers every supported mode in the option list', () => {
		expect(TRADEPILOT_MODE_OPTIONS.map((option) => option.value)).toEqual([
			'portfolio',
			'coach',
			'gold',
			'general'
		]);
	});

	it('provides starter prompts for each mode', () => {
		expect(Object.keys(TRADEPILOT_STARTER_PROMPTS)).toEqual([
			'portfolio',
			'coach',
			'gold',
			'general'
		]);
	});
});

describe('filterTradePilotChats', () => {
	const chats: BigLotAiChat[] = [
		{
			id: 'chat-1',
			owner_user_id: 'user-1',
			client_account_id: 'acc-1',
			surface_role: 'client',
			surface_context: 'portfolio',
			title: 'Weekly recap',
			last_message_at: null,
			archived_at: null,
			created_at: '',
			updated_at: ''
		},
		{
			id: 'chat-2',
			owner_user_id: 'user-1',
			client_account_id: 'acc-1',
			surface_role: 'client',
			surface_context: 'portfolio',
			title: 'Gold bias setup',
			last_message_at: null,
			archived_at: null,
			created_at: '',
			updated_at: ''
		}
	];

	it('returns all chats when query is blank', () => {
		expect(filterTradePilotChats(chats, '  ')).toHaveLength(2);
	});

	it('matches titles case-insensitively', () => {
		expect(filterTradePilotChats(chats, 'gold')).toEqual([chats[1]]);
		expect(filterTradePilotChats(chats, 'WEEKLY')).toEqual([chats[0]]);
	});
});

