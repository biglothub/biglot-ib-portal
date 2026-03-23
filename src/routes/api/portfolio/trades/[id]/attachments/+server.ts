import { rateLimit } from '$lib/server/rate-limit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { json } from '@sveltejs/kit';
import { verifyTradeOwnership, isSafeUrl } from '$lib/server/trade-guard';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;

	const { data, error } = await locals.supabase
		.from('trade_attachments')
		.select('*')
		.eq('trade_id', params.id)
		.eq('user_id', profile.id)
		.order('sort_order', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	// Generate fresh signed URLs for screenshot attachments
	if (data && data.length > 0) {
		const serviceClient = createSupabaseServiceClient();
		for (const att of data) {
			if (att.kind === 'screenshot') {
				const { data: signedData } = await serviceClient.storage
					.from('trade-screenshots')
					.createSignedUrl(att.storage_path, 3600);
				if (signedData?.signedUrl) att.storage_path = signedData.signedUrl;
			}
		}
	}

	return json({ attachments: data || [] });
};

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:trade-attachments:${profile.id}`, 20, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;

	const { id, kind, storage_path, caption, sort_order } = await request.json();
	if (!storage_path?.trim()) {
		return json({ message: 'storage_path is required' }, { status: 400 });
	}

	if (!isSafeUrl(storage_path.trim())) {
		return json({ message: 'Invalid URL — only http/https allowed' }, { status: 400 });
	}

	const validKinds = ['link', 'image_url', 'screenshot'];
	if (kind && !validKinds.includes(kind)) {
		return json({ message: 'Invalid attachment kind' }, { status: 400 });
	}

	const payload = {
		id: id || undefined,
		trade_id: params.id,
		user_id: profile.id,
		kind: kind || 'link',
		storage_path: storage_path.trim(),
		caption: caption || '',
		sort_order: Number.isFinite(sort_order) ? sort_order : 0
	};

	const query = id
		? locals.supabase
				.from('trade_attachments')
				.update(payload)
				.eq('id', id)
				.eq('user_id', profile.id)
				.select()
				.single()
		: locals.supabase.from('trade_attachments').insert(payload).select().single();

	const { data, error } = await query;
	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true, attachment: data });
};

export const DELETE: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:attachments:delete:${profile.id}`, 20, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;

	const { id } = await request.json();
	if (!id) {
		return json({ message: 'Attachment id is required' }, { status: 400 });
	}

	// Fetch the attachment to check kind and get storage_path for cleanup
	const { data: attachment } = await locals.supabase
		.from('trade_attachments')
		.select('kind, storage_path')
		.eq('id', id)
		.eq('trade_id', params.id)
		.eq('user_id', profile.id)
		.single();

	// Clean up storage for screenshot attachments
	if (attachment?.kind === 'screenshot' && attachment.storage_path) {
		try {
			const serviceClient = createSupabaseServiceClient();
			await serviceClient.storage
				.from('trade-screenshots')
				.remove([attachment.storage_path]);
		} catch (e) {
			console.error('Failed to remove file from storage:', e);
		}
	}

	const { error } = await locals.supabase
		.from('trade_attachments')
		.delete()
		.eq('id', id)
		.eq('trade_id', params.id)
		.eq('user_id', profile.id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};
