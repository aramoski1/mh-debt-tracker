"use client";

import { useEffect, useState } from "react";
import { DESK_MODULES, resolveDesk, type DeskModuleId } from "@/lib/desk";

const KEY = "desk-modules";

export function Customize({ onChange }: { onChange: (visible: Record<DeskModuleId, boolean>) => void }) {
  const [visible, setVisible] = useState<Record<DeskModuleId, boolean> | null>(null);

  useEffect(() => {
    const stored = (() => {
      try {
        return JSON.parse(localStorage.getItem(KEY) || "null") as Partial<Record<DeskModuleId, boolean>> | null;
      } catch {
        return null;
      }
    })();
    const next = resolveDesk(stored);
    setVisible(next);
    onChange(next);
  }, [onChange]);

  if (!visible) return null;

  function toggle(id: DeskModuleId) {
    const next = { ...visible!, [id]: !visible![id] };
    setVisible(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    onChange(next);
  }

  return (
    <details className="rounded-md border border-line bg-panel px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">Customize</summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {DESK_MODULES.map(([id, label]) => (
          <li key={id}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={visible[id]} onChange={() => toggle(id)} />
              {label}
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}
