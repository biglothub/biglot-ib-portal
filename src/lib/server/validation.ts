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

	// Check total content length (rough token estimation — 1 char ≈ 1 token for Thai)
	const totalChars = validated.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
	if (totalChars > 24000) {
		return { valid: false, status: 413, error: 'ข้อความยาวเกินไป กรุณาเริ่มบทสนทนาใหม่' };
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

const BIGLOT_AI_MODES = ['portfolio', 'coach', 'gold', 'general'] as const;

export function validateBigLotAiMode(mode: unknown): mode is (typeof BIGLOT_AI_MODES)[number] {
	return typeof mode === 'string' && BIGLOT_AI_MODES.includes(mode as (typeof BIGLOT_AI_MODES)[number]);
}

export function validateBigLotAiRunBody(
	body: unknown
):
	| { valid: true; chatId: string | null; mode: (typeof BIGLOT_AI_MODES)[number]; message: string }
	| { valid: false; error: string; status: number } {
	if (!body || typeof body !== 'object') {
		return { valid: false, error: 'ข้อมูลไม่ถูกต้อง', status: 400 };
	}

	const chatId = 'chatId' in body && typeof body.chatId === 'string' && body.chatId.trim()
		? body.chatId.trim()
		: null;
	const mode = 'mode' in body ? body.mode : 'portfolio';
	const message = 'message' in body && typeof body.message === 'string' ? body.message.trim() : '';

	if (!validateBigLotAiMode(mode)) {
		return { valid: false, error: 'โหมดไม่ถูกต้อง', status: 400 };
	}
	if (!message) {
		return { valid: false, error: 'กรุณากรอกข้อความ', status: 400 };
	}
	if (message.length > 4000) {
		return { valid: false, error: 'ข้อความยาวเกินไป', status: 413 };
	}

	return { valid: true, chatId, mode, message };
}

export function validateBigLotAiFeedbackBody(
	body: unknown
):
	| { valid: true; messageId: string; runId: string | null; feedback: 'positive' | 'negative'; reason: string | null }
	| { valid: false; error: string; status: number } {
	if (!body || typeof body !== 'object') {
		return { valid: false, error: 'ข้อมูลไม่ถูกต้อง', status: 400 };
	}

	const messageId = 'messageId' in body && typeof body.messageId === 'string' ? body.messageId.trim() : '';
	const runId = 'runId' in body && typeof body.runId === 'string' && body.runId.trim() ? body.runId.trim() : null;
	const feedback = 'feedback' in body ? body.feedback : null;
	const reason = 'reason' in body && typeof body.reason === 'string' && body.reason.trim()
		? body.reason.trim().slice(0, 500)
		: null;

	if (!messageId) {
		return { valid: false, error: 'ไม่พบข้อความที่ต้องการให้ feedback', status: 400 };
	}
	if (feedback !== 'positive' && feedback !== 'negative') {
		return { valid: false, error: 'feedback ไม่ถูกต้อง', status: 400 };
	}

	return { valid: true, messageId, runId, feedback, reason };
}

export function inferBigLotAiTitle(message: string): string {
	const clean = message.replace(/\s+/g, ' ').trim();
	if (!clean) return 'TradePilot';
	return clean.length > 48 ? `${clean.slice(0, 45)}...` : clean;
}
