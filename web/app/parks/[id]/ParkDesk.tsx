"use client";

import { useState } from "react";

type Doc = { id: string; title: string; url: string | null; page: number | null; field: string | null; value: string | null; quote: string | null; status: string };
type Field = { slug: string; label: string };
type Rent = { id: string; submarket: string; lot_rent: number | null; source: string; observed_on: string | null };

export function ParkDesk({
  parkId, watching, checked, documents, fields, values, rents,
}: {
  parkId: string;
  watching: boolean;
  checked: string | null;
  documents: Doc[];
  fields: Field[];
  values: Record<string, string>;
  rents: Rent[];
}) {
  const [on, setOn] = useState(watching);
  const [msg, setMsg] = useState<string | null>(null);
  const [docs, setDocs] = useState(documents);
  const [saved, setSaved] = useState(values);

  async function watch() {
    const next = !on;
    const res = await fetch("/api/watches", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, watching: next }),
    });
    if (!res.ok) { setMsg("Could not update the watch."); return; }
    setOn(next);
    setMsg(next ? "Watching. A nightly check will flag a change and will not overwrite the owner or the loan." : "Watch removed.");
  }

  async function addDoc(form: FormData) {
    const res = await fetch("/api/documents", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parkId,
        title: form.get("title"),
        url: form.get("url"),
        page: form.get("page"),
        field: form.get("field"),
        value: form.get("value"),
        quote: form.get("quote"),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Quote saved for review." : (body.error ?? "Could not save the quote."));
  }

  async function review(doc: Doc, action: "accept" | "reject") {
    const res = await fetch("/api/documents", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, id: doc.id, quote: doc.quote, field: doc.field, value: doc.value, parkId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(body.error ?? "Could not review that quote."); return; }
    setDocs((rows) => rows.map((row) => row.id === doc.id ? { ...row, status: action === "accept" ? "accepted" : "rejected" } : row));
    setMsg(action === "accept" && doc.field === "lot_rent" ? "Accepted. Lot rent was written as a document source." : "Review saved.");
  }

  async function saveField(slug: string, value: string) {
    const res = await fetch("/api/fields", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId, slug, value }),
    });
    if (!res.ok) { setMsg("Could not save that field."); return; }
    setSaved((cur) => ({ ...cur, [slug]: value }));
    setMsg("Field saved.");
  }

  async function addRent(form: FormData) {
    const res = await fetch("/api/rents", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submarket: form.get("submarket"),
        lotRent: form.get("lotRent"),
        source: form.get("source"),
        observedOn: form.get("observedOn"),
      }),
    });
    setMsg(res.ok ? "Rent comp saved." : "Could not save the rent comp.");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Watch</h2>
            <p className="text-xs text-muted">
              {checked ? `Last checked ${checked.slice(0, 10)}.` : on ? "Enrolled. Not checked yet." : "Not watched. Nothing has been checked."}
            </p>
          </div>
          <button type="button" className="h-8 rounded-sm border border-line px-3 text-sm" onClick={watch}>{on ? "Watching" : "Watch this park"}</button>
        </div>
      </section>

      <section className="rounded-md border border-line bg-panel p-4">
        <h2 className="text-sm font-medium">Document quotes</h2>
        <p className="mt-1 text-xs text-muted">Paste a quote from a filing or a note. Accepting lot rent writes it onto the operating record and locks that field as a document. Other fields stay on this list until you use them.</p>
        <ul className="mt-2 space-y-2">
          {docs.map((doc) => (
            <li key={doc.id} className="rounded-sm border border-line p-2 text-sm">
              <p className="font-medium">{doc.title}{doc.page ? ` · page ${doc.page}` : ""} · {doc.status}</p>
              <p className="text-body">“{doc.quote}”</p>
              {doc.url && <a className="text-xs text-accent" href={doc.url} target="_blank" rel="noreferrer">Open the file</a>}
              {doc.status === "pending" && (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="h-8 rounded-sm border border-line px-2 text-xs" onClick={() => review(doc, "accept")}>Accept</button>
                  <button type="button" className="h-8 rounded-sm border border-line px-2 text-xs" onClick={() => review(doc, "reject")}>Reject</button>
                </div>
              )}
            </li>
          ))}
          {!docs.length && <li className="text-sm text-muted">No quotes yet. Paste one from a document you already have.</li>}
        </ul>
        <form action={addDoc} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input name="title" placeholder="Document title" className="h-8 rounded-sm border border-line px-2 text-sm" required />
          <input name="url" placeholder="Link, if you have one" className="h-8 rounded-sm border border-line px-2 text-sm" />
          <input name="page" placeholder="Page" className="h-8 rounded-sm border border-line px-2 text-sm" />
          <select name="field" className="h-8 rounded-sm border border-line px-2 text-sm" defaultValue="lot_rent">
            <option value="lot_rent">Lot rent</option>
            <option value="maturity_date">Maturity date</option>
            <option value="note">Note only</option>
          </select>
          <input name="value" placeholder="Value, as printed" className="h-8 rounded-sm border border-line px-2 text-sm" />
          <input name="quote" placeholder="Exact quote" className="h-8 rounded-sm border border-line px-2 text-sm sm:col-span-2" required />
          <button className="h-8 rounded-sm border border-line-strong px-3 text-sm sm:col-span-2" type="submit">Save quote</button>
        </form>
      </section>

      <section className="rounded-md border border-line bg-panel p-4">
        <h2 className="text-sm font-medium">Your fields</h2>
        <ul className="mt-2 space-y-2">
          {fields.map((field) => (
            <li key={field.slug} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-40">{field.label}</span>
              <input defaultValue={saved[field.slug] ?? ""} className="h-8 rounded-sm border border-line px-2" onBlur={(e) => saveField(field.slug, e.target.value)} />
            </li>
          ))}
          {!fields.length && <li className="text-sm text-muted">No custom fields defined.</li>}
        </ul>
      </section>

      <section className="rounded-md border border-line bg-panel p-4">
        <h2 className="text-sm font-medium">Rent notebook</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {rents.map((rent) => (
            <li key={rent.id}>{rent.submarket}: ${rent.lot_rent ?? "—"} / site · {rent.source}{rent.observed_on ? ` · ${rent.observed_on}` : ""}</li>
          ))}
          {!rents.length && <li className="text-muted">No rent comps entered. Public data does not include lot rent.</li>}
        </ul>
        <form action={addRent} className="mt-3 grid gap-2 sm:grid-cols-4">
          <input name="submarket" placeholder="Submarket" className="h-8 rounded-sm border border-line px-2 text-sm" required />
          <input name="lotRent" placeholder="Lot rent" className="h-8 rounded-sm border border-line px-2 text-sm" required />
          <input name="source" placeholder="Source" className="h-8 rounded-sm border border-line px-2 text-sm" required />
          <input name="observedOn" type="date" className="h-8 rounded-sm border border-line px-2 text-sm" />
          <button className="h-8 rounded-sm border border-line px-3 text-sm" type="submit">Add</button>
        </form>
      </section>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
