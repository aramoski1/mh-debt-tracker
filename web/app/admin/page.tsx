import Link from "next/link";
import { PageHeader } from "@/components/ui/Bits";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <PageHeader kicker="Admin" title="Desk settings" lede="Sources, the buy box, and where accounts live. Spread overrides are not a second set of numbers; the model uses a measured spread only when that lender type has at least 8 loans." />
      <ul className="divide-y divide-line rounded-md border border-line bg-panel">
        <li className="px-4 py-3">
          <Link href="/admin/audit" className="font-medium hover:text-accent">Park audit</Link>
          <p className="text-sm text-muted">Placeholder names, government owners, missing owners, and loans with no maturity date.</p>
        </li>
        <li className="px-4 py-3">
          <Link href="/freshness" className="font-medium hover:text-accent">Data sources</Link>
          <p className="text-sm text-muted">Last run, status, and the error or row counts from that run.</p>
        </li>
        <li className="px-4 py-3">
          <Link href="/rates" className="font-medium hover:text-accent">Rate desk</Link>
          <p className="text-sm text-muted">Treasury, SOFR, and the measured spreads. The sample size is the audit of which spread the model will use.</p>
        </li>
        <li className="px-4 py-3">
          <Link href="/pipeline" className="font-medium hover:text-accent">Buy box</Link>
          <p className="text-sm text-muted">Site count, states, and park types the desk treats as in bounds.</p>
        </li>
        <li className="px-4 py-3">
          <p className="font-medium">Users</p>
          <p className="text-sm text-muted">Accounts are the people invited in Supabase. This desk does not keep a second user list.</p>
        </li>
      </ul>
    </div>
  );
}
