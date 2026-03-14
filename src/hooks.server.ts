import { createSupabaseServerClient } from '$lib/server/supabase';
import { redirect, type Handle } from '@sveltejs/kit';

const PUBLIC_ROUTES = ['/auth/login', '/auth/forgot-password', '/auth/callback', '/offline'];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event);

	event.locals.safeGetSession = async () => {
		const { data: { user }, error } = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };

		return { session: null, user };
	};

	const { user } = await event.locals.safeGetSession();
	event.locals.session = null;
	event.locals.user = user;

	if (user) {
		const { data: profile } = await event.locals.supabase
			.from('profiles')
			.select('id, email, full_name, role, avatar_url')
			.eq('id', user.id)
			.single();
		event.locals.profile = profile;
	} else {
		event.locals.profile = null;
	}

	const path = event.url.pathname;

	// Allow public routes
	if (PUBLIC_ROUTES.some(r => path.startsWith(r))) {
		return resolve(event, {
			filterSerializedResponseHeaders(name) {
				return name === 'content-range' || name === 'x-supabase-api-version';
			}
		});
	}

	// Redirect to login if not authenticated
	if (!user) {
		throw redirect(303, '/auth/login');
	}

	const role = event.locals.profile?.role;

	// Route guards
	if (path.startsWith('/admin') && role !== 'admin') {
		throw redirect(303, role === 'master_ib' ? '/ib' : '/portfolio');
	}
	if (path.startsWith('/ib') && role !== 'master_ib' && role !== 'admin') {
		throw redirect(303, role === 'client' ? '/portfolio' : '/auth/login');
	}
	if (path.startsWith('/portfolio') && role !== 'client') {
		throw redirect(303, role === 'admin' ? '/admin' : role === 'master_ib' ? '/ib' : '/auth/login');
	}

	// Redirect root based on role
	if (path === '/') {
		const redirectMap: Record<string, string> = {
			admin: '/admin',
			master_ib: '/ib',
			client: '/portfolio'
		};
		throw redirect(303, redirectMap[role || ''] || '/auth/login');
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
