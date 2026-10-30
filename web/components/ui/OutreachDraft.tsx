"use client";

import { useState } from "react";

export function OutreachDraft({ to, subject, body, href }: { to: string; subject: string; body: string; href: string | null }) {
  const [copied, setCopied] = useState(false);

  return (
    <details className="rounded-md border border-line bg-panel px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">Email draft</summary>
      <p className="mt-2 text-xs text-muted">Built from the call line on this park. This desk does not send mail.</p>
      <p className="mt-2 text-sm"><span className="text-muted">To </span>{to || "No email on the park or the owner record."}</p>
      <p className="text-sm"><span className="text-muted">Subject </span>{subject}</p>
      <pre className="mt-2 whitespace-pre-wrap rounded-sm border border-line bg-sunken p-3 text-sm">{body}</pre>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          className="h-8 rounded-sm border border-line px-3 text-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(to ? `To: ${to}\nSubject: ${subject}\n\n${body}` : `Subject: ${subject}\n\n${body}`);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {href && <a className="inline-flex h-8 items-center text-sm text-accent" href={href}>Open in email</a>}
      </div>
    </details>
  );
}
