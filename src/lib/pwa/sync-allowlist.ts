export const SYNC_ALLOWLIST = [
	{ method: 'POST', pattern: /^\/api\/portfolio\/journal$/ },
	{ method: 'POST', pattern: /^\/api\/portfolio\/trades\/[^/]+\/review$/ },
	{ method: 'PATCH', pattern: /^\/api\/portfolio\/trades\/[^/]+\/review$/ },
	{ method: 'POST', pattern: /^\/api\/portfolio\/notes$/ }
] as const;

const DENY_PATTERNS = [
	/^\/api\/admin\//,
	/^\/api\/ib\/clients\/.*\/approve/,
	/\/delete(?:\/|$)/,
	/\/approval(?:s)?(?:\/|$)/
] as const;

export function canQueue({ method, endpoint }: { method: string; endpoint: string }) {
	const upperMethod = method.toUpperCase();
	if (upperMethod === 'DELETE') return false;
	if (DENY_PATTERNS.some((pattern) => pattern.test(endpoint))) return false;
	return SYNC_ALLOWLIST.some(
		(rule) => rule.method === upperMethod && rule.pattern.test(endpoint)
	);
}
