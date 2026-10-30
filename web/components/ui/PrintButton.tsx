"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-8 rounded-sm border border-line px-3 text-sm">
      Print
    </button>
  );
}
