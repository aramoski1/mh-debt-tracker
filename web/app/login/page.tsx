"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded border border-stone-200 bg-white p-6">
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      {sent ? (
        <p>Check {email} for a sign-in link.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                 className="h-9 w-full rounded border border-stone-300 px-2" />
          <button className="h-9 w-full rounded bg-stone-900 font-medium text-white">Email me a link</button>
          {err && <p className="text-red-700">{err}</p>}
          <p className="text-xs text-stone-500">First time here creates your account. We’ll email you a sign-in link.</p>
        </form>
      )}
    </div>
  );
}
