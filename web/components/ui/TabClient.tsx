"use client";

import { useState, type ReactNode } from "react";

export function TabClient({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [id, setId] = useState(tabs[0]?.id ?? "");
  return (
    <div>
      <div role="tablist" aria-label="Sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab) => {
          const on = tab.id === id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={on}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setId(tab.id)}
              className={`h-9 shrink-0 border-b-2 px-3 text-sm ${on ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) =>
        tab.id === id ? (
          <div key={tab.id} role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} className="pt-3">
            {tab.content}
          </div>
        ) : null,
      )}
    </div>
  );
}
