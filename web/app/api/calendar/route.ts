import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function vevent(uid: string, date: string, summary: string) {
  const stamp = date.replace(/-/g, "");
  return ["BEGIN:VEVENT", `UID:${uid}`, `DTSTART;VALUE=DATE:${stamp}`, `SUMMARY:${summary}`, "END:VEVENT"].join("\r\n");
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parkId = new URL(req.url).searchParams.get("park");
  if (!parkId) return NextResponse.json({ error: "Missing park" }, { status: 400 });
  const [{ data: park }, { data: deal }] = await Promise.all([
    supabase.from("park_overview").select("id, name, maturity_date, maturity_basis").eq("id", parkId).maybeSingle(),
    supabase.from("deals").select("diligence_date, close_date").eq("park_id", parkId).maybeSingle(),
  ]);
  const row = park as { id: string; name: string; maturity_date: string | null; maturity_basis: string | null } | null;
  if (!row) return NextResponse.json({ error: "Park not found" }, { status: 404 });
  const dealRow = deal as { diligence_date?: string | null; close_date?: string | null } | null;
  const events: string[] = [];
  if (row.maturity_date && (row.maturity_basis === "reported" || row.maturity_basis === "document")) {
    events.push(vevent(`${row.id}-maturity`, row.maturity_date, `${row.name} maturity`));
  }
  if (dealRow?.diligence_date) events.push(vevent(`${row.id}-diligence`, dealRow.diligence_date, `${row.name} diligence ends`));
  if (dealRow?.close_date) events.push(vevent(`${row.id}-close`, dealRow.close_date, `${row.name} close`));
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cooper Cardinal//Desk//EN", ...events, "END:VCALENDAR"].join("\r\n");
  return new NextResponse(ics, { headers: { "content-type": "text/calendar; charset=utf-8" } });
}
