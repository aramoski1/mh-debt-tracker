"use client";

export function ConfirmDialog({
  open, title, body, danger, busy, onCancel, onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-inverse/40 px-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-sm rounded-lg border border-line bg-panel p-4 shadow-overlay" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-2 text-sm text-body">{body}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="h-8 rounded-sm border border-line px-3 text-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={`h-8 rounded-sm px-3 text-sm ${danger ? "bg-negative-soft text-accent" : "border border-line-strong"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "Working" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
