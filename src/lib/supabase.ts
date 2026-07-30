// Supabase client singleton. Reads the Vite-prefixed env vars that are injected
// at build time. The buffer-proxy / ai-generate / alerts-check edge functions use
// the user's JWT from this client's session for authentication.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error("Supabase env vars missing. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const EDGE_BASE = `${url}/functions/v1`;
