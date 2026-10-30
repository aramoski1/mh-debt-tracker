"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const NAV = [
  { href: "/", label: "Prospects" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/rates", label: "Rate desk" },
  { href: "/markets", label: "Markets" },
  { href: "/signals", label: "Signals" },
  { href: "/owners", label: "Owners" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/alerts", label: "Alerts" },
  { href: "/admin", label: "Admin" },
];

function active(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export default function Shell({ children, demo }: { children: React.ReactNode; demo: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("desk-theme");
    const next = saved === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
    setCollapsed(localStorage.getItem("desk-nav") === "collapsed");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        setQuery("");
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setPalette(true);
        setQuery("");
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = NAV.filter((item) => !q || item.label.toLowerCase().includes(q));
    const search = q ? [{ href: `/?q=${encodeURIComponent(query.trim())}`, label: `Search prospects for “${query.trim()}”` }] : [];
    return [...search, ...pages];
  }, [query]);

  if (path.startsWith("/login") || path.startsWith("/styleguide")) return <>{children}</>;

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
    localStorage.setItem("desk-theme", next);
  };

  const toggleNav = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("desk-nav", next ? "collapsed" : "open");
  };

  return (
    <div className="min-h-screen bg-paper text-fg">
      {open && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-inverse/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-panel transition-[width] duration-150 ${collapsed ? "w-14" : "w-52"} ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <Link href="/" className="flex h-12 items-center gap-2 border-b border-line px-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-inverse text-2xs font-medium text-on-inverse">CC</span>
          {!collapsed && (
            <span className="leading-tight">
              <span className="block text-2xs tracking-wide text-muted">Cooper Cardinal</span>
              <span className="block text-sm font-medium">Debt desk</span>
            </span>
          )}
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Primary">
          {NAV.map((item) => {
            const on = active(path, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setOpen(false)}
                aria-label={item.label}
                className={`flex h-8 items-center gap-2 rounded-sm px-2 text-sm ${on ? "bg-sunken font-medium text-fg" : "text-body hover:bg-sunken"} ${collapsed ? "justify-center" : ""}`}
              >
                {collapsed ? <span aria-hidden="true" className="text-2xs text-muted">{item.label.slice(0, 1)}</span> : item.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" onClick={toggleNav} className="hidden h-10 border-t border-line text-xs text-muted hover:text-fg lg:block">
          {collapsed ? "»" : "Collapse"}
        </button>
      </aside>
      <div className={collapsed ? "lg:pl-14" : "lg:pl-52"}>
        <header className="sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-line bg-panel px-3">
          <button type="button" className="h-8 rounded-sm border border-line px-2 text-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            Menu
          </button>
          <button type="button" onClick={() => setPalette(true)} className="hidden h-8 flex-1 items-center rounded-sm border border-line bg-sunken px-3 text-left text-sm text-muted sm:flex">
            Search parks, or jump to a page
            <kbd className="ml-auto rounded-sm border border-line bg-panel px-1 text-2xs">Ctrl K</kbd>
          </button>
          {demo && <span className="rounded-sm bg-caution-soft px-2 py-0.5 text-xs text-gold">Demo data</span>}
          <button type="button" onClick={toggleTheme} className="ml-auto h-8 rounded-sm border border-line px-2 text-xs text-body" aria-pressed={theme === "dark"}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </header>
        <main className="mx-auto max-w-screen-2xl px-4 py-4">{children}</main>
      </div>
      {palette && (
        <div className="fixed inset-0 z-50 grid place-items-start bg-inverse/40 px-4 pt-[15vh]" onClick={() => setPalette(false)}>
          <div role="dialog" aria-label="Command palette" className="w-full max-w-lg rounded-lg border border-line bg-panel shadow-overlay" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or jump"
              aria-label="Search or jump"
              className="h-11 w-full border-b border-line bg-transparent px-3 text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  router.push(results[0].href);
                  setPalette(false);
                }
              }}
            />
            <ul className="max-h-72 overflow-auto py-1">
              {results.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setPalette(false)} className="block px-3 py-2 text-sm hover:bg-sunken">
                    {item.label}
                  </Link>
                </li>
              ))}
              {!results.length && <li className="px-3 py-3 text-sm text-muted">Nothing matches.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
