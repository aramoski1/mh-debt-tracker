import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { demoClient, isDemo } from "./demo";

export async function supabaseServer(): Promise<SupabaseClient> {
  // Demo mode returns a stand-in with the same shape for the calls this app makes.
  if (isDemo()) return demoClient() as unknown as SupabaseClient;
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; middleware refreshes the session.
        }
      },
    },
  });
}
