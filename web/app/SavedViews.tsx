"use client";

import { useEffect, useState } from "react";

type View = { name: string; href: string };

const KEY = "desk-views";

export function SavedViews({ current }: { current: Record<string, string | undefined> }) {
  const [views, setViews] = useState<View[]>([]);

  const [name, setName] = useState("");

  useEffect(() => {
    let local: View[] = [];
    try {
      local = JSON.parse(localStorage.getItem(KEY) || "[]") as View[];
    } catch {
      local = [];
    }
    setViews(local);
    fetch("/api/views").then(async (res) => {
      if (!res.ok) return;
      const body = await res.json();
      const remote = ((body.views ?? []) as { name: string; params: Record<string, string> }[]).map((view) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(view.params ?? {})) if (value) params.set(key, value);
        return { name: view.name, href: params.size ? `/?${params}` : "/" };
      });
      setViews((cur) => {
        const names = new Set(remote.map((view) => view.name));
        return [...remote, ...cur.filter((view) => !names.has(view.name))];
      });
    }).catch(() => undefined);
  }, []);

  function save() {
    const label = name.trim();
    if (!label) return;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(current)) if (value) params[key] = value;
    const href = Object.keys(params).length ? `/?${new URLSearchParams(params)}` : "/";
    const next = [...views.filter((view) => view.name !== label), { name: label, href }];
    localStorage.setItem(KEY, JSON.stringify(next));
    setViews(next);
    setName("");
    fetch("/api/views", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: label, params }) }).catch(() => undefined);
  }

  function remove(name: string) {
    const next = views.filter((view) => view.name !== name);
    localStorage.setItem(KEY, JSON.stringify(next));
    setViews(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {views.map((view) => (
        <span key={view.name} className="inline-flex items-center gap-1 rounded-sm border border-line bg-panel px-2 py-1">
          <a href={view.href} className="hover:text-accent">{view.name}</a>
          <button type="button" className="text-xs text-muted" onClick={() => remove(view.name)} aria-label={`Remove ${view.name}`}>×</button>
        </span>
      ))}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this view" className="h-8 rounded-sm border border-line px-2 text-sm" />
      <button type="button" onClick={save} className="h-8 rounded-sm border border-line px-2 text-sm">Save view</button>
    </div>
  );
}
