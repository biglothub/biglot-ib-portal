import { json } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import { rateLimit } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.profile?.role !== 'admin') {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!(await rateLimit(`admin:coaches:${ip}`, 30, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const body = await request.json();
	const { name, channel_name, youtube_handle, avatar_url, start_hour, end_hour, time_display, color_gradient, color_border, color_text, color_bg, glow_rgb, sort_order } = body;

	if (!name || !channel_name || !youtube_handle || !time_display) {
		return json({ message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
	}

	if (start_hour == null || end_hour == null || start_hour < 0 || start_hour > 23 || end_hour < 0 || end_hour > 26) {
		return json({ message: 'เวลาไม่ถูกต้อง' }, { status: 400 });
	}

	const supabase = createSupabaseServiceClient();
	const { data, error } = await supabase
		.from('coaches')
		.insert({
			name,
			channel_name,
			youtube_handle,
			avatar_url: avatar_url || null,
			start_hour,
			end_hour,
			time_display,
			color_gradient: color_gradient || 'from-blue-500 to-indigo-400',
			color_border: color_border || 'border-blue-500/30',
			color_text: color_text || 'text-blue-400',
			color_bg: color_bg || 'bg-blue-500/10',
			glow_rgb: glow_rgb || '59,130,246',
			sort_order: sort_order ?? 0
		})
		.select()
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ coach: data });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (locals.profile?.role !== 'admin') {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!(await rateLimit(`admin:coaches:${ip}`, 30, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const body = await request.json();
	const { id, ...updates } = body;

	if (!id) {
		return json({ message: 'ต้องระบุ ID โค้ช' }, { status: 400 });
	}

	const supabase = createSupabaseServiceClient();
	const { data, error } = await supabase
		.from('coaches')
		.update({ ...updates, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select()
		.single();

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ coach: data });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (locals.profile?.role !== 'admin') {
		return json({ message: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
	}

	const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
	if (!(await rateLimit(`admin:coaches:${ip}`, 30, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const { id } = await request.json();
	if (!id) {
		return json({ message: 'ต้องระบุ ID โค้ช' }, { status: 400 });
	}

	const supabase = createSupabaseServiceClient();
	const { error } = await supabase.from('coaches').delete().eq('id', id);

	if (error) {
		return json({ message: error.message }, { status: 500 });
	}

	return json({ success: true });
};
