import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { secureStorage } from '$lib/auth/secure-storage';
import type { Database } from './database.types';

export const authStorageKey = 'astronida.auth';

export const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
	auth: {
		flowType: 'pkce',
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: false,
		storageKey: authStorageKey,
		storage: secureStorage
	}
});
