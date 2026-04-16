import { archiveBigLotAiChat, createBigLotAiChat, listBigLotAiChats, resolveBigLotAiScope } from '$lib/server/biglot-ai';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const scope = await resolveBigLotAiScope(event);
	if (!scope) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const chats = await listBigLotAiChats(scope);
	return json({ chats });
};

export const POST: RequestHandler = async (event) => {
	const scope = await resolveBigLotAiScope(event);
	if (!scope) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	let body: { title?: unknown; action?: unknown; chatId?: unknown };
	try {
		body = await event.request.json();
	} catch {
		body = {};
	}

	if (body.action === 'archive' && typeof body.chatId === 'string' && body.chatId.trim()) {
		const archived = await archiveBigLotAiChat(scope, body.chatId.trim());
		return json({ archived });
	}

	const title = typeof body.title === 'string' ? body.title.trim() : undefined;
	const chat = await createBigLotAiChat(scope, title);
	return json({ chat }, { status: 201 });
};
