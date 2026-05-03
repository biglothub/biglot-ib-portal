import { rateLimit } from '$lib/server/rate-limit';
import { invalidateTradesCache } from '$lib/server/portfolio';
import { handleIdempotentRequest } from '$lib/server/idempotency';
import { json } from '@sveltejs/kit';
import { verifyTradeOwnership } from '$lib/server/trade-guard';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	const profile = locals.profile;
	if (!profile) {
		return json({ message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
	}
	if (profile.role !== 'client') {
		return json(
			{ message: 'การบันทึก Review รองรับเฉพาะบัญชี client เท่านั้น (Admin/IB ดูได้อย่างเดียว)' },
			{ status: 403 }
		);
	}

	if (!(await rateLimit(`portfolio:trade-review:${profile.id}`, 20, 60_000))) {
		return json({ message: 'คำขอมากเกินไป กรุณารอสักครู่' }, { status: 429 });
	}

	const ownership = await verifyTradeOwnership(locals.supabase, params.id, profile.id);
	if (!ownership.ok) return ownership.response;
	const { accountId } = ownership;

	const body = await request.json();
	const {
		playbook_id,
		review_status,
		entry_reason,
		exit_reason,
		execution_notes,
		risk_notes,
		mistake_summary,
		lesson_summary,
		next_action,
		setup_quality_score,
		discipline_score,
		execution_score,
		confidence_at_entry,
		followed_plan,
		broken_rules
	} = body;

	const validStatuses = ['unreviewed', 'in_progress', 'reviewed'];
	if (review_status && !validStatuses.includes(review_status)) {
		return json({ message: 'Invalid review_status' }, { status: 400 });
	}

	for (const [name, value] of [
		['setup_quality_score', setup_quality_score],
		['discipline_score', discipline_score],
		['execution_score', execution_score],
		['confidence_at_entry', confidence_at_entry]
	] as const) {
		if (value !== null && value !== undefined && (value < 1 || value > 5)) {
			return json({ message: `${name} must be 1-5` }, { status: 400 });
		}
	}

	const payload: Record<string, unknown> = {
		trade_id: params.id,
		user_id: profile.id,
		playbook_id: playbook_id || null,
		review_status: review_status || 'in_progress',
		entry_reason: entry_reason || '',
		exit_reason: exit_reason || '',
		execution_notes: execution_notes || '',
		risk_notes: risk_notes || '',
		mistake_summary: mistake_summary || '',
		lesson_summary: lesson_summary || '',
		next_action: next_action || '',
		setup_quality_score: setup_quality_score ?? null,
		discipline_score: discipline_score ?? null,
		execution_score: execution_score ?? null,
		confidence_at_entry: confidence_at_entry ?? null,
		followed_plan:
			followed_plan === true || followed_plan === false ? followed_plan : null,
		broken_rules: Array.isArray(broken_rules) ? broken_rules.filter(Boolean) : [],
		updated_at: new Date().toISOString()
	};

	// Only set reviewed_at when transitioning to 'reviewed'. Preserve existing
	// timestamp on re-save; never null it out on non-reviewed saves so that
	// downgrading status doesn't erase the original review timestamp.
	if (review_status === 'reviewed') {
		const { data: existing } = await locals.supabase
			.from('trade_reviews')
			.select('reviewed_at')
			.eq('trade_id', params.id)
			.maybeSingle();
		payload.reviewed_at = existing?.reviewed_at ?? new Date().toISOString();
	}

	return handleIdempotentRequest({
		supabase: locals.supabase,
		request,
		userId: profile.id,
		body,
		execute: async () => {
			// Upsert with .select().single() so a silent RLS reject (0 rows affected) surfaces as an error
			const { error: upsertError } = await locals.supabase
				.from('trade_reviews')
				.upsert(payload, { onConflict: 'trade_id' })
				.select()
				.single();

			if (upsertError) {
				console.error('[review] upsert failed:', upsertError.message, upsertError.code);
				return json({ message: upsertError.message }, { status: 500 });
			}

			// Fetch the saved review with playbook join (separate from upsert to avoid PostgREST join issues)
			const { data, error: fetchError } = await locals.supabase
				.from('trade_reviews')
				.select('*, playbooks(id, name, description)')
				.eq('trade_id', params.id)
				.single();

			if (fetchError) {
				console.error('[review] fetch after upsert failed:', fetchError.message);
			}

			invalidateTradesCache(accountId);

			return json({ success: true, review: data ?? null });
		}
	});
};
