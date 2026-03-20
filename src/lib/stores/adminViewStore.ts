import { writable, derived } from 'svelte/store';

/** Holds the account_id when admin is viewing a client's portfolio */
export const adminViewAccountId = writable<string | null>(null);

/** Builds a portfolio link, appending ?account_id=xxx for admin view */
export const portfolioLink = derived(adminViewAccountId, ($id) => {
	return (path: string) => {
		if (!$id) return path;
		const separator = path.includes('?') ? '&' : '?';
		return `${path}${separator}account_id=${$id}`;
	};
});
