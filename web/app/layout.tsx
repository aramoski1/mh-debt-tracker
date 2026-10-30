import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Shell from "@/components/ui/Shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Cooper Cardinal Debt Desk",
  description: "Loan maturities and owner pressure for mobile home and RV parks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = process.env.NEXT_PUBLIC_SUPABASE_URL === "demo";
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className} min-h-screen text-sm antialiased`}>
        <Shell demo={demo}>{children}</Shell>
      </body>
    </html>
  );
}
