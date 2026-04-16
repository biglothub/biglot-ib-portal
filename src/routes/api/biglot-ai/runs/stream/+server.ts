import { runBigLotAiStream } from '$lib/server/biglot-ai';
import { validateBigLotAiRunBody } from '$lib/server/validation';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return new Response(JSON.stringify({ message: 'ข้อมูลไม่ถูกต้อง' }), { status: 400 });
	}

	const result = validateBigLotAiRunBody(body);
	if (!result.valid) {
		return new Response(JSON.stringify({ message: result.error }), { status: result.status });
	}

	return runBigLotAiStream(event, result);
};
