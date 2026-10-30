"use client";

import { useState } from "react";

type Contact = { id: string; name: string | null; role: string; phone: string | null; email: string | null; mailing: string | null; source: string; verified: boolean };

export function Contacts({ ownerId, parkId, rows }: { ownerId: string; parkId: string | null; rows: Contact[] }) {
  const [list, setList] = useState(rows);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(form: FormData) {
    const name = String(form.get("name") ?? "");
    const res = await fetch("/api/contacts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ownerId, parkId, name,
        role: form.get("role"),
        phone: form.get("phone"),
        email: form.get("email"),
        mailing: form.get("mailing"),
        source: "manual",
      }),
    });
    if (!res.ok) { setMsg("Could not save the contact."); return; }
    setList((cur) => [...cur, { id: name, name, role: String(form.get("role") ?? "owner"), phone: String(form.get("phone") ?? ""), email: String(form.get("email") ?? ""), mailing: String(form.get("mailing") ?? ""), source: "manual", verified: false }]);
    setMsg("Saved as unverified. Confirm it before you rely on it.");
  }

  async function paste(form: FormData) {
    if (!parkId) { setMsg("This owner has no park to attach the note to."); return; }
    const body = String(form.get("paste") ?? "").trim();
    if (!body) return;
    const res = await fetch("/api/notes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, kind: "note", body: `Arizona Corporation Commission paste:\n${body}` }),
    });
    setMsg(res.ok ? "Paste saved as a note. Officers are not extracted unless a quote is in the paste." : "Could not save the paste.");
  }

  return (
    <section className="rounded-md border border-line bg-panel p-4">
      <h2 className="text-sm font-medium">Contacts</h2>
      <p className="mt-1 text-xs text-muted">Assessor mailing, a phone already on the park, or something you are licensed to use. Nothing here is skip-traced.</p>
      <ul className="mt-2 space-y-1 text-sm">
        {list.map((row) => (
          <li key={row.id}>{row.name} · {row.role} · {row.phone || row.email || row.mailing || "—"} · {row.verified ? "verified" : "unverified"} · {row.source}</li>
        ))}
        {!list.length && <li className="text-muted">No contacts yet.</li>}
      </ul>
      <form action={add} className="mt-3 grid gap-2 sm:grid-cols-3">
        <input name="name" placeholder="Name" required className="h-8 rounded-sm border border-line px-2 text-sm" />
        <select name="role" className="h-8 rounded-sm border border-line px-2 text-sm" defaultValue="owner">
          {["owner", "manager", "broker", "lender", "attorney"].map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <input name="phone" placeholder="Phone" className="h-8 rounded-sm border border-line px-2 text-sm" />
        <input name="email" placeholder="Email" className="h-8 rounded-sm border border-line px-2 text-sm" />
        <input name="mailing" placeholder="Mailing address" className="h-8 rounded-sm border border-line px-2 text-sm sm:col-span-2" />
        <button className="h-8 rounded-sm border border-line px-3 text-sm" type="submit">Add contact</button>
      </form>
      <form action={paste} className="mt-3 space-y-2">
        <textarea name="paste" rows={3} placeholder="Paste what you found on eCorp" className="w-full rounded-sm border border-line p-2 text-sm" />
        <button className="h-8 rounded-sm border border-line px-3 text-sm" type="submit">Save paste</button>
      </form>
      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </section>
  );
}
