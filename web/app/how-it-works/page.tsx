import { PageHeader } from "@/components/ui/Bits";
import { GUIDES } from "@/lib/guides";

export const dynamic = "force-dynamic";

export default function HowItWorks() {
  return (
    <div className="space-y-4">
      <PageHeader kicker="Help" title="How this desk works" lede="Cooper Cardinal buys and operates parks. The desk finds owners under debt pressure. It does not list parks for other people." />
      <section className="rounded-md border border-line bg-panel p-4">
        <h2 className="text-sm font-medium">Honest limits</h2>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-body">
          <li>Most county-loan maturities are estimated. A date from a document is labeled.</li>
          <li>About 34 percent of parks have an owner name. About 13 percent have any loan. About 2 percent have a reported maturity on an open loan.</li>
          <li>Rent is blank until someone enters it. The refinance gap says when it is using a market estimate.</li>
          <li>The desk does not send mail, scrape listings, or look up the Arizona Corporation Commission for you.</li>
        </ul>
      </section>
      {GUIDES.map((guide) => (
        <section key={guide.route} className="rounded-md border border-line bg-panel p-4">
          <h2 className="text-sm font-medium">{guide.title}</h2>
          <p className="mt-1 text-sm text-body">{guide.purpose}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted">
            {guide.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>
      ))}
    </div>
  );
}
