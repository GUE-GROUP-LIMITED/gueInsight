// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const createFallbackClient = () => ({
	auth: {
		getSession: async () => ({ data: { session: null }, error: null }),
		onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
		signOut: async () => ({ error: null }),
		resetPasswordForEmail: async () => ({
			data: null,
			error: { message: 'Password reset service is currently unavailable. Please contact support.' },
		}),
	},
});

export const supabase =
	supabaseUrl && supabaseAnonKey
		? createClient(supabaseUrl, supabaseAnonKey)
		: createFallbackClient();