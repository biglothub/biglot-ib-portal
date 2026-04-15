import type { PageServerLoad } from './$types';

export interface Coach {
	id: string;
	name: string;
	channel_name: string;
	youtube_handle: string;
	youtube_channel_id: string | null;
	avatar_url: string | null;
	start_hour: number;
	end_hour: number;
	time_display: string;
	color_gradient: string;
	color_border: string;
	color_text: string;
	color_bg: string;
	glow_rgb: string;
	is_active: boolean;
	sort_order: number;
}

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase;

	const { data: coaches } = await supabase
		.from('coaches')
		.select('id, name, channel_name, youtube_handle, youtube_channel_id, avatar_url, start_hour, end_hour, time_display, color_gradient, color_border, color_text, color_bg, glow_rgb, is_active, sort_order')
		.eq('is_active', true)
		.order('sort_order', { ascending: true });

	return {
		coaches: (coaches ?? []) as Coach[]
	};
};
