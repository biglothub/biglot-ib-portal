import { rateLimit } from '$lib/server/rate-limit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { json } from '@sveltejs/kit';
import { verifyTradeOwnership } from '$lib/server/trade-guard';
import type { RequestHandler } from './$types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile || profile.role !== 'client') {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 403 });
	}

	if (!(await rateLimit(`portfolio:screenshot-upload:${profile.id}`, 10, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return json({ message: 'Invalid form data' }, { status: 400 });
	}

	const file = formData.get('file');
	const caption = (formData.get('caption') as string | null) ?? '';

	if (!(file instanceof File)) {
		return json({ message: 'ไม่พบไฟล์ภาพ' }, { status: 400 });
	}

	if (!ALLOWED_TYPES.has(file.type)) {
		return json({ message: 'รองรับเฉพาะไฟล์ PNG, JPEG, WebP' }, { status: 400 });
	}

	if (file.size > MAX_FILE_SIZE) {
		return json({ message: 'ไฟล์ใหญ่เกิน 10 MB' }, { status: 400 });
	}

	const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
	const filename = `${profile.id}/${params.id}/${Date.now()}.${ext}`;

	const buffer = await file.arrayBuffer();

	const serviceClient = createSupabaseServiceClient();
	const { error: uploadError } = await serviceClient.storage
		.from('trade-screenshots')
		.upload(filename, buffer, { contentType: file.type, upsert: false });

	if (uploadError) {
		return json({ message: `อัปโหลดไม่สำเร็จ: ${uploadError.message}` }, { status: 500 });
	}

	// Get signed URL (valid 10 years — effectively permanent for this use case)
	const { data: signedData, error: signError } = await serviceClient.storage
		.from('trade-screenshots')
		.createSignedUrl(filename, 60 * 60 * 24 * 365 * 10);

	if (signError || !signedData?.signedUrl) {
		return json({ message: 'อัปโหลดสำเร็จแต่สร้าง URL ไม่ได้' }, { status: 500 });
	}

	// Save to trade_attachments
	const { data: attachment, error: dbError } = await locals.supabase
		.from('trade_attachments')
		.insert({
			trade_id: params.id,
			user_id: profile.id,
			kind: 'screenshot',
			storage_path: signedData.signedUrl,
			caption: caption.trim(),
			sort_order: 0
		})
		.select()
		.single();

	if (dbError) {
		return json({ message: dbError.message }, { status: 500 });
	}

	return json({ success: true, attachment });
};
