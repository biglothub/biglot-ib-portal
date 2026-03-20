import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{
				session: Session | null;
				user: User | null;
			}>;
			session: Session | null;
			user: User | null;
			profile: {
				id: string;
				email: string;
				full_name: string;
				role: 'admin' | 'master_ib' | 'client';
				avatar_url: string | null;
			} | null;
			/** Admin "View As" mode — set when admin views a client's portfolio */
			viewAsAccountId?: string;
			viewAsUserId?: string;
		}
		interface PageData {
			user: User | null;
			profile: App.Locals['profile'];
		}
	}
}

export {};
