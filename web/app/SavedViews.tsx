"use client";

import { useEffect, useState } from "react";

type View = { name: string; href: string };

const KEY = "desk-views";

export function SavedViews({ current }: { current: Record<string, string | undefined> }) {
  const [views, setViews] = useState<View[]>([]);

  useEffect(() => {
    try {
      setViews(JSON.parse(localStorage.getItem(KEY) || "[]") as View[]);
    } catch {
      setViews([]);
    }
  }, []);

  function save() {
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(current)) if (value) params.set(key, value);
    const next = [...views.filter((view) => view.name !== name.trim()), { name: name.trim(), href: params.size ? `/?${params}` : "/" }];
    localStorage.setItem(KEY, JSON.stringify(next));
    setViews(next);
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
      <button type="button" onClick={save} className="h-8 rounded-sm border border-line px-2 text-sm">Save view</button>
    </div>
  );
}
