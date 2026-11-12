"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "create";

function readable(error: { message: string; code?: string }) {
  const message = error.message || "";
  if (/fetch failed|failed to fetch|network/i.test(message)) {
    return "The account service could not be reached. The Supabase address for this desk does not resolve, so no email can be sent until that project is restored.";
  }
  if (error.code === "otp_disabled" || /signups not allowed|user not found|not found/i.test(message)) {
    return "No account uses that email yet. Use Create account first.";
  }
  return message;
}

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === "create",
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setErr(readable(error));
      else setSent(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not reach the account service.";
      setErr(readable({ message }));
    } finally {
      setBusy(false);
    }
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
            <p className="text-sm">Check {email} for a {mode === "signin" ? "sign-in" : "confirmation"} link.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 border-b border-line" role="tablist">
                <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => { setMode("signin"); setErr(null); }}
                        className={`h-9 text-sm ${mode === "signin" ? "border-b-2 border-accent font-medium text-fg" : "text-muted"}`}>
                  Sign in
                </button>
                <button type="button" role="tab" aria-selected={mode === "create"} onClick={() => { setMode("create"); setErr(null); }}
                        className={`h-9 text-sm ${mode === "create" ? "border-b-2 border-accent font-medium text-fg" : "text-muted"}`}>
                  Create account
                </button>
              </div>
              <label className="block text-xs text-muted" htmlFor="email">Work email</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     className="h-9 w-full rounded-sm border border-line bg-panel px-2 text-sm" />
              <button disabled={busy} className="h-9 w-full rounded-sm bg-accent text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60">
                {busy ? "Sending" : mode === "signin" ? "Email me a sign-in link" : "Create account"}
              </button>
              {err && <p className="text-sm text-negative">{err}</p>}
              <p className="text-xs text-muted">
                {mode === "signin"
                  ? "For an email that already has an account. This does not create one."
                  : "Sends a link and creates the account the first time this email is used."}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
