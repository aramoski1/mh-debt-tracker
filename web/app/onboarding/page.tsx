import Link from "next/link";
import { PageHeader } from "@/components/ui/Bits";
import { ImportParks } from "./ImportParks";

export const dynamic = "force-dynamic";

const STEPS = [
  ["1. Mark the parks you already run", "Open a park and choose Mark managed, or paste names on Portfolio. Distance in the fit score starts working after that."],
  ["2. Set the buy box", "Pipeline → Buy box. Site count, state, and park type. A second named box can be saved later."],
  ["3. Cadence", "Tier 1 is a live deal or a score of 60 or more, every 14 days. Tier 2 is inside the buy box, every 30 days. Everything else is 90 days."],
  ["4. Land on Today", "The morning list is ranked. A trustee sale comes before a reminder."],
];

export default function Onboarding() {
  return (
    <div className="space-y-4">
      <PageHeader kicker="Start" title="Set up the desk" lede="Four steps. Nothing here creates an account or a paid key." />
      <ImportParks />
      <ol className="space-y-3">
        {STEPS.map(([title, body]) => (
          <li key={title} className="rounded-md border border-line bg-panel p-4">
            <h2 className="text-sm font-medium">{title}</h2>
            <p className="mt-1 text-sm text-body">{body}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm"><Link href="/desk" className="text-accent">Open Today</Link> · <Link href="/pipeline" className="text-accent">Set the buy box</Link></p>
    </div>
  );
}
