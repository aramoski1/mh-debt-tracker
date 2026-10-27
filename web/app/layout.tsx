import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Park Debt Tracker",
  description: "Mobile home and RV park loan maturities and owner pressure",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen text-sm antialiased">
        <header className="sticky top-0 z-20 border-b border-stone-200 bg-white">
          <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-6 px-4">
            <Link href="/" className="font-semibold tracking-tight">
              Park Debt Tracker
            </Link>
            <nav className="flex gap-4 text-stone-600">
              <Link href="/" className="hover:text-stone-900">
                Prospects
              </Link>
              <Link href="/alerts" className="hover:text-stone-900">
                Alerts
              </Link>
            </nav>
            {process.env.NEXT_PUBLIC_SUPABASE_URL === "demo" && (
              <span className="ml-auto rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                Demo data: fictional parks, owners and loans
              </span>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-4">{children}</main>
      </body>
    </html>
  );
}
