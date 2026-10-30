import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { parseAsk } from "@/lib/ask";
import { FABRICATION_RULE } from "@/lib/copilot-knowledge";
import { callLine } from "@/lib/brief";
import { monthYear } from "@/lib/format";
import { applyProspectFilters, narrowProspects } from "@/lib/prospects";
import { supabaseServer } from "@/lib/supabase/server";
import { BASIS_LABEL, type ParkRow } from "@/lib/types";

function fallback(rows: ParkRow[], intro: string) {
  if (!rows.length) return `${intro} Nothing on the desk matches.`;
  const lines = rows.slice(0, 8).map((park) => {
    const basis = park.maturity_basis ? BASIS_LABEL[park.maturity_basis] : "Unknown";
    return `${park.name} in ${park.city ?? "—"} — score ${park.score == null ? "—" : Math.round(park.score)}, ${basis.toLowerCase()} maturity ${monthYear(park.maturity_date)}. ${callLine(park)} /parks/${park.id}`;
  });
  return `${intro}\n\n${lines.join("\n\n")}`;
}

async function narrate(question: string, rows: ParkRow[]) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const packed = rows.slice(0, 12).map((park) => ({
    name: park.name,
    city: park.city,
    county: park.county,
    units: park.units,
    owner: park.owner_name,
    owner_state: park.owner_state,
    score: park.score,
    lender: park.lender_name,
    loan_status: park.loan_status,
    balance: park.current_balance ?? park.original_amount,
    note_rate: park.note_rate,
    maturity_date: park.maturity_date,
    maturity_basis: park.maturity_basis,
    phone: park.phone,
    call_line: callLine(park),
  }));
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: process.env.FAST_MODEL || "claude-haiku-5-5",
    max_tokens: 700,
    system: [
      "You answer a broker at Cooper Cardinal who buys and refinances Arizona mobile-home and RV parks.",
      "Use only the JSON parks. If maturity_basis is estimated, call the date estimated. If it is reported or document, call it documented.",
      FABRICATION_RULE,
      "Do not mention Florida leases, Sunbiz, or CoStar.",
    ].join(" "),
    messages: [{ role: "user", content: `Question: ${question}\n\nParks:\n${JSON.stringify(packed)}` }],
  });
  const text = msg.content.find((block) => block.type === "text");
  return text && text.type === "text" ? text.text : null;
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) return NextResponse.json({ error: "Ask a question" }, { status: 400 });

  const parsed = parseAsk(question);
  if (parsed.intent !== "search") {
    return NextResponse.json({ reply: parsed.reply, understood: parsed.understood, ignored: parsed.ignored, href: parsed.href, parks: [] });
  }

  const { data, error } = await applyProspectFilters(
    supabase.from("park_overview").select("*").order("score", { ascending: false, nullsFirst: false }).limit(2000),
    parsed.params,
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = narrowProspects((data ?? []) as ParkRow[], parsed.params);
  let reply = fallback(rows, parsed.reply);
  try {
    reply = (await narrate(question, rows)) ?? reply;
  } catch {
    reply = fallback(rows, parsed.reply);
  }
  return NextResponse.json({
    reply: `${reply}\n\nVerify every figure on the park page. This desk does not send mail.`,
    href: parsed.href,
    understood: parsed.understood,
    ignored: parsed.ignored,
    parks: rows.slice(0, 8).map((park) => ({ id: park.id, name: park.name })),
  });
}
