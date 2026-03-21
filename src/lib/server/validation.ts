/** Validate AI chat messages: role whitelist, format, alternation, length limits */
export function validateChatMessages(
	messages: unknown
): { valid: true; messages: { role: string; content: string }[] } | { valid: false; error: string; status: number } {
	if (!Array.isArray(messages) || messages.length === 0) {
		return { valid: false, error: 'Messages required', status: 400 };
	}

	if (messages.length > 50) {
		return { valid: false, error: 'Too many messages', status: 400 };
	}

	const validated: { role: string; content: string }[] = [];

	for (const msg of messages) {
		if (!msg || typeof msg !== 'object' || !('role' in msg) || !('content' in msg)) {
			return { valid: false, error: 'Invalid message format', status: 400 };
		}
		if (!msg.role || !msg.content || typeof msg.content !== 'string') {
			return { valid: false, error: 'Invalid message format', status: 400 };
		}
		// Only allow 'user' and 'assistant' roles — reject 'system', 'tool', or any other role
		if (msg.role !== 'user' && msg.role !== 'assistant') {
			return { valid: false, error: 'Invalid message role', status: 400 };
		}
		validated.push({
			role: msg.role as string,
			content: msg.content.length > 2000 ? msg.content.slice(0, 2000) : msg.content
		});
	}

	// Enforce strict alternation: must start with 'user', alternate user/assistant, end with 'user'
	if (validated[0].role !== 'user' || validated[validated.length - 1].role !== 'user') {
		return { valid: false, error: 'Invalid message sequence', status: 400 };
	}
	for (let i = 1; i < validated.length; i++) {
		if (validated[i].role === validated[i - 1].role) {
			return { valid: false, error: 'Invalid message sequence', status: 400 };
		}
	}

	return { valid: true, messages: validated };
}

/** Sanitize search input: whitelist safe characters only, escape SQL LIKE wildcards */
export function sanitizeSearchQuery(str: string): string {
	// Strip everything except alphanumeric, Thai chars, spaces, hyphens, and underscores
	const whitelisted = str.replace(/[^\p{L}\p{N}\s\-_]/gu, '');
	// Escape SQL LIKE wildcards
	return whitelisted.replace(/[%_\\]/g, c => '\\' + c);
}
