import { createHash } from 'node:crypto';
import { json, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

type Json =
	| string
	| number
	| boolean
	| null
	| Json[]
	| { [key: string]: Json };

interface IdempotencyOptions {
	supabase: SupabaseClient;
	request: RequestEvent['request'];
	userId: string;
	body: Json;
	execute: () => Promise<Response>;
	ttlHours?: number;
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	return `{${Object.keys(value as Record<string, unknown>)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
		.join(',')}}`;
}

function payloadHash(body: Json) {
	return createHash('sha256').update(stableStringify(body)).digest('hex');
}

function isJsonResponse(response: Response) {
	return response.headers.get('content-type')?.includes('application/json');
}

export async function handleIdempotentRequest({
	supabase,
	request,
	userId,
	body,
	execute,
	ttlHours = 24
}: IdempotencyOptions) {
	const key = request.headers.get('Idempotency-Key');
	if (!key) return execute();

	const hash = payloadHash(body);
	const expiresBefore = new Date(Date.now() - ttlHours * 60 * 60 * 1000).toISOString();

	await supabase
		.from('idempotency_records')
		.delete()
		.eq('user_id', userId)
		.lt('created_at', expiresBefore);

	const { data: existing, error: existingError } = await supabase
		.from('idempotency_records')
		.select('payload_hash, response_body, status_code')
		.eq('user_id', userId)
		.eq('idempotency_key', key)
		.maybeSingle();

	if (existingError) {
		return json({ message: existingError.message }, { status: 500 });
	}

	if (existing) {
		if (existing.payload_hash !== hash) {
			return json({ message: 'Idempotency-Key payload mismatch' }, { status: 409 });
		}
		return json(existing.response_body ?? {}, { status: existing.status_code ?? 200 });
	}

	const response = await execute();
	const status = response.status;

	if (isJsonResponse(response)) {
		const responseBody = (await response.clone().json().catch(() => null)) as Json;
		await supabase.from('idempotency_records').insert({
			user_id: userId,
			idempotency_key: key,
			payload_hash: hash,
			response_body: responseBody,
			status_code: status
		});
	}

	return response;
}
