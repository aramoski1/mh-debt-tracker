import { notFound } from "next/navigation";
import { Metric, MetricStrip, PageHeader } from "@/components/ui/Bits";
import { scoreLabel, scoreTone } from "@/lib/format";

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-screen space-y-6 bg-paper p-6 text-fg">
      <PageHeader kicker="Internal" title="Style guide" lede="Hidden in production. Tokens live in web/app/tokens.css." />
      <MetricStrip>
        <Metric label="Balance" value="$4.2M" detail="As of the last filing" />
        <Metric label="Note rate" value="6.85%" />
        <Metric label="Spread" value="+264 bps" />
        <Metric label="DSCR" value="1.18x" />
      </MetricStrip>
      <div className="flex gap-2">
        {[20, 35, 50, 70].map((score) => (
          <span key={score} className={`num rounded-sm px-2 py-1 text-sm font-medium ${scoreTone(score)}`}>
            {score} {scoreLabel(score)}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="h-8 rounded-sm bg-accent px-3 text-sm text-on-accent">Primary</button>
        <button type="button" className="h-8 rounded-sm border border-line bg-panel px-3 text-sm">Secondary</button>
        <button type="button" className="h-8 rounded-sm px-3 text-sm text-negative">Danger</button>
      </div>
    </div>
  );
}
