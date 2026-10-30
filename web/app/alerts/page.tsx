import { supabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/Bits";
import AlertsList from "./AlertsList";

export const dynamic = "force-dynamic";

export default async function Alerts() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("alerts").select("*, parks(name, city)").order("created_at", { ascending: false }).limit(300);
  return (
    <div className="space-y-4">
      <PageHeader kicker="Alerts" title="What changed" lede="Grouped by the day the row was written. Snooze hides it in this browser until you reload." />
      <AlertsList rows={data ?? []} />
    </div>
  );
}
