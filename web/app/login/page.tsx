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
    <div className="grid min-h-screen place-items-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-md border border-line bg-panel">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-sm bg-inverse text-xs font-medium text-on-inverse">CC</span>
          <div>
            <p className="text-xs text-muted">Cooper Cardinal</p>
            <h1 className="text-base font-medium">Debt desk</h1>
          </div>
        </div>
        <div className="p-5">
          {sent ? (
            <p className="text-sm">Check {email} for a sign-in link.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-xs text-muted" htmlFor="email">Work email</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     className="h-9 w-full rounded-sm border border-line bg-panel px-2 text-sm" />
              <button className="h-9 w-full rounded-sm bg-accent text-sm font-medium text-on-accent hover:bg-accent-hover">Email me a link</button>
              {err && <p className="text-sm text-negative">{err}</p>}
              <p className="text-xs text-muted">The first email creates your account.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
