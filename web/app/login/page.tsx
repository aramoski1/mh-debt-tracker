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
    <div className="mx-auto mt-10 max-w-sm overflow-hidden rounded-sm border border-[#e2e2e2] bg-white">
      <div className="border-b-2 border-[#dd9933] bg-[#18191b] px-6 py-5 text-white">
        <p className="text-[10px] font-medium tracking-[0.28em] text-white/70">COOPER CARDINAL</p>
        <h1 className="text-lg font-medium">Debt Desk</h1>
      </div>
      <div className="p-6">
      {sent ? (
        <p>Check {email} for a sign-in link.</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                 className="h-9 w-full rounded-sm border border-[#e2e2e2] px-2" />
          <button className="h-9 w-full rounded-sm bg-[#85152a] font-medium text-white hover:bg-[#6e1023]">Email me a link</button>
          {err && <p className="text-[#85152a]">{err}</p>}
          <p className="text-xs text-[#787d85]">First time here creates your account. We’ll email you a sign-in link.</p>
        </form>
      )}
      </div>
    </div>
  );
}
