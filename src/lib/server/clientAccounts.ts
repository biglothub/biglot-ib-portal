export const CLIENT_ACCOUNT_PUBLIC_COLUMNS = `
	id,
	user_id,
	master_ib_id,
	client_name,
	client_email,
	client_phone,
	nickname,
	mt5_account_id,
	mt5_server,
	status,
	submitted_at,
	reviewed_at,
	reviewed_by,
	rejection_reason,
	mt5_validated,
	mt5_validation_error,
	last_validated_at,
	last_synced_at,
	sync_error,
	sync_count,
	created_at,
	updated_at
`.replace(/\s+/g, ' ').trim();

export function normalizeEmail(value: string | null | undefined): string | null {
	const normalized = value?.trim().toLowerCase() ?? '';
	return normalized || null;
}

export { isValidEmail } from '$lib/utils';

export function normalizeIbCode(value: string): string {
	return value.trim().toUpperCase();
}

export function getDatabaseErrorStatus(code?: string): number {
	switch (code) {
		case '23505':
			return 409;
		case '42501':
			return 403;
		case 'P0001':
		case '22023':
			return 400;
		default:
			return 500;
	}
}
