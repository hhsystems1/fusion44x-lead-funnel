import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabaseServerEnv } from "@/lib/env";

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getServerSupabaseClient() {
  if (cachedClient) return cachedClient;

  const env = requireSupabaseServerEnv();

  cachedClient = createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
