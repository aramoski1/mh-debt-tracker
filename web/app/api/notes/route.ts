import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const TOOL = {
  name: "record_call_facts",
  description: "Structured facts from a broker's call note with a park owner.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: { type: "string" },
      outcome: { type: "string", enum: ["no_answer", "not_interested", "interested", "listing", "refi_referral", "other"] },
      next_follow_up: { type: ["string", "null"], description: "YYYY-MM-DD if a date or timeframe was given" },
      lender_mentioned: { type: ["string", "null"] },
      maturity_mentioned: { type: ["string", "null"], description: "YYYY-MM-DD or YYYY-MM" },
      rate_mentioned_pct: { type: ["number", "null"] },
      balance_mentioned: { type: ["number", "null"] },
      motivation: { type: ["string", "null"] },
      asking_price: { type: ["number", "null"] },
    },
    required: ["summary", "outcome"],
  },
};

type Facts = {
  summary?: string;
  outcome?: string;
  next_follow_up?: string | null;
  lender_mentioned?: string | null;
  maturity_mentioned?: string | null;
  rate_mentioned_pct?: number | null;
  balance_mentioned?: number | null;
  motivation?: string | null;
};

async function structure(note: string): Promise<Facts | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: process.env.FAST_MODEL || "claude-haiku-5-5",
    max_tokens: 600,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: `Today is ${new Date().toISOString().slice(0, 10)}. Broker's call note:\n\n${note}` }],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  return block && block.type === "tool_use" ? (block.input as Facts) : null;
}

const isoDate = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s && /^\d{4}-\d{2}$/.test(s) ? `${s}-01` : null);

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { parkId, body, kind } = (await req.json()) as { parkId?: string; body?: string; kind?: string };
  if (!parkId || !body?.trim()) return NextResponse.json({ error: "Missing note" }, { status: 400 });
  const activityKind = kind === "email" || kind === "visit" || kind === "note" || kind === "call" ? kind : "call";

  let facts: Facts | null = null;
  try {
    facts = await structure(body);
  } catch {
    facts = null; // the note still saves; structure is a bonus
  }

  const { error } = await supabase.from("activities").insert({
    park_id: parkId,
    author_id: user.id,
    author_name: user.email,
    kind: activityKind,
    body,
    outcome: facts?.outcome ?? null,
    next_follow_up: isoDate(facts?.next_follow_up),
    extracted: facts,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, facts });
}
