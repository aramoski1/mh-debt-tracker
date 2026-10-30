"use client";

import { useEffect, useState } from "react";
import { DESK_MODULES, resolveDesk, resolveOrder, type DeskModuleId } from "@/lib/desk";

const KEY = "desk-modules";

export function Customize({ onChange }: { onChange: (visible: Record<DeskModuleId, boolean>, order: DeskModuleId[]) => void }) {
  const [visible, setVisible] = useState<Record<DeskModuleId, boolean> | null>(null);
  const [order, setOrder] = useState<DeskModuleId[]>(DESK_MODULES.map(([id]) => id));
  const [drag, setDrag] = useState<DeskModuleId | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = (() => {
        try {
          return JSON.parse(localStorage.getItem(KEY) || "null") as { visible?: Partial<Record<DeskModuleId, boolean>>; order?: string[] } | Partial<Record<DeskModuleId, boolean>> | null;
        } catch {
          return null;
        }
      })();
      let remote: { visible?: Partial<Record<DeskModuleId, boolean>>; order?: string[] } | null = null;
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const body = await res.json();
          remote = body.dashboard;
        }
      } catch {
        remote = null;
      }
      if (cancelled) return;
      const bag = remote ?? (stored && "visible" in (stored as object) ? stored as { visible?: Partial<Record<DeskModuleId, boolean>>; order?: string[] } : { visible: stored as Partial<Record<DeskModuleId, boolean>> | null, order: null });
      const nextVisible = resolveDesk(bag?.visible ?? null);
      const nextOrder = resolveOrder(bag?.order ?? null);
      setVisible(nextVisible);
      setOrder(nextOrder);
      onChange(nextVisible, nextOrder);
    })();
    return () => { cancelled = true; };
  }, [onChange]);

  function persist(nextVisible: Record<DeskModuleId, boolean>, nextOrder: DeskModuleId[]) {
    const dashboard = { visible: nextVisible, order: nextOrder };
    localStorage.setItem(KEY, JSON.stringify(dashboard));
    onChange(nextVisible, nextOrder);
    fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dashboard }) }).catch(() => undefined);
  }

  function toggle(id: DeskModuleId) {
    if (!visible) return;
    const next = { ...visible, [id]: !visible[id] };
    setVisible(next);
    persist(next, order);
  }

  function drop(id: DeskModuleId) {
    if (!drag || drag === id || !visible) return;
    const next = [...order];
    const from = next.indexOf(drag);
    const to = next.indexOf(id);
    next.splice(from, 1);
    next.splice(to, 0, drag);
    setOrder(next);
    setDrag(null);
    persist(visible, next);
  }

  if (!visible) return null;
  const hidden = DESK_MODULES.every(([id]) => !visible[id]);

  return (
    <details className="rounded-md border border-line bg-panel px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">Customize</summary>
      {hidden && <p className="mt-2 text-sm text-muted">Every block is hidden. Turn one back on.</p>}
      <ul className="mt-2 grid gap-1">
        {order.map((id) => {
          const label = DESK_MODULES.find(([key]) => key === id)?.[1] ?? id;
          return (
            <li key={id} draggable onDragStart={() => setDrag(id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(id)}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={visible[id]} onChange={() => toggle(id)} />
                {label}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Drag a row to reorder. The layout is saved for this account.</p>
    </details>
  );
}
