import type { ReactNode } from "react";
import Link from "next/link";
import { TabClient } from "./TabClient";

export function PageHeader({ kicker, title, lede, actions }: { kicker: string; title: string; lede?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-2xs font-medium tracking-wide text-muted">{kicker}</p>
        <h1 className="text-xl font-medium tracking-tight text-fg">{title}</h1>
        {lede && <p className="mt-1 max-w-2xl text-sm text-body">{lede}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="bg-panel px-4 py-3">
      <p className="text-2xs font-medium tracking-wide text-muted">{label}</p>
      <p className="num mt-1 text-2xl font-medium text-fg">{value}</p>
      {detail && <p className="text-xs text-muted">{detail}</p>}
    </div>
  );
}

export function MetricStrip({ children, cols = "sm:grid-cols-4" }: { children: ReactNode; cols?: string }) {
  return <section className={`grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line ${cols}`}>{children}</section>;
}

export function Basis({ basis }: { basis: string | null | undefined }) {
  if (basis === "reported") return <span title="Figure reported on a filing">Reported</span>;
  if (basis === "document") return <span title="Read from a recorded document">From document</span>;
  if (basis === "estimated") return <span className="underline decoration-dotted underline-offset-2" title="Estimated. The range is on the park page.">Estimated</span>;
  if (!basis || basis === "unknown") return <span>—</span>;
  return <span>{basis}</span>;
}

export function Tabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  return <TabClient tabs={tabs} />;
}

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-md border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium text-fg hover:text-accent">{children}</Link>;
}
