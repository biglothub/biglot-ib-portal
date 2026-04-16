import { resolveBigLotAiScope } from '$lib/server/biglot-ai';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { validateBigLotAiFeedbackBody } from '$lib/server/validation';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const scope = await resolveBigLotAiScope(event);
	if (!scope) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ message: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
	}

	const result = validateBigLotAiFeedbackBody(body);
	if (!result.valid) {
		return json({ message: result.error }, { status: result.status });
	}

	const service = createSupabaseServiceClient();
	const { data: messageRow } = await service
		.from('ai_messages')
		.select('id, chat_id')
		.eq('id', result.messageId)
		.maybeSingle();

	if (!messageRow) {
		return json({ message: 'ไม่พบข้อความ' }, { status: 404 });
	}

	const { data: chatRow } = await service
		.from('ai_chats')
		.select('id')
		.eq('id', messageRow.chat_id)
		.eq('owner_user_id', scope.targetUserId)
		.eq('client_account_id', scope.clientAccountId)
		.maybeSingle();

	if (!chatRow) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const { error } = await service.from('ai_feedback').upsert({
		message_id: result.messageId,
		run_id: result.runId,
		owner_user_id: scope.targetUserId,
		feedback: result.feedback,
		reason: result.reason
	});

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ ok: true });
};
