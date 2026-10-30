import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import KeyNav from "./KeyNav";

const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "Cooper Cardinal Debt Desk",
  description: "Loan maturities and owner pressure for mobile home and RV parks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.className} min-h-screen text-sm antialiased`}>
        <header className="sticky top-0 z-20 border-b-2 border-[#dd9933] bg-[#18191b] text-white">
          <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-8 px-4">
            <Link href="/" className="leading-tight">
              <span className="block text-[10px] font-medium tracking-[0.28em] text-white/80">COOPER CARDINAL</span>
              <span className="block text-base font-medium tracking-tight">Debt Desk</span>
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-white/75">
              <Link href="/" className="hover:text-white">Prospects</Link>
              <Link href="/#calls" className="hover:text-white">This week</Link>
              <Link href="/rates" className="hover:text-white">Rates</Link>
              <Link href="/signals" className="hover:text-white">Signals</Link>
              <Link href="/pipeline" className="hover:text-white">Pipeline</Link>
              <Link href="/portfolio" className="hover:text-white">Portfolio</Link>
              <Link href="/alerts" className="hover:text-white">Alerts</Link>
              <Link href="/freshness" className="hover:text-white">Freshness</Link>
            </nav>
            {process.env.NEXT_PUBLIC_SUPABASE_URL === "demo" && (
              <span className="ml-auto rounded-sm bg-[#dd9933] px-2 py-0.5 text-xs font-medium text-[#18191b]">
                Demo data
              </span>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>
        <KeyNav />
      </body>
    </html>
  );
}
