import { getBigLotAiMessages, resolveBigLotAiScope } from '$lib/server/biglot-ai';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const scope = await resolveBigLotAiScope(event);
	if (!scope) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const messages = await getBigLotAiMessages(scope, event.params.chatId);
	return json({ messages });
};
