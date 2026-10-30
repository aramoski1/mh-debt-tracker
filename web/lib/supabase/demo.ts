// Demo mode: NEXT_PUBLIC_SUPABASE_URL=demo serves fictional parks from demo/data.json so the app can be
// tried before a Supabase project exists. Supports the small subset of the query API the app uses.
import data from "@/demo/data.json";
import desk from "@/demo/desk.json";

type Row = Record<string, unknown>;
const base = data as unknown as Record<string, Row[]>;
const extra = desk as unknown as Record<string, Row[]>;
const tables: Record<string, Row[]> = { ...base };
for (const [key, rows] of Object.entries(extra)) tables[key] = [...(tables[key] ?? []), ...rows];
const written: Record<string, Row[]> = {};
const dropped = new Set<string>();

function rowKey(table: string, row: Row) {
  return `${table}:${String(row.park_id ?? row.id ?? "")}`;
}

function rowsOf(table: string): Row[] {
  const base = (tables[table] ?? []).filter((r) => !dropped.has(rowKey(table, r)));
  const over = written[table] ?? [];
  const overKeys = new Set(over.map((r) => rowKey(table, r)));
  return [...over, ...base.filter((r) => !overKeys.has(rowKey(table, r)))];
}

class Query implements PromiseLike<{ data: unknown; error: null }> {
  private filters: ((r: Row) => boolean)[] = [];
  private sortKey: string | null = null;
  private asc = true;
  private max = Infinity;
  private single = false;

  private op: "select" | "update" | "delete" = "select";
  private patch: Row | null = null;

  constructor(private table: string) {}

  select() { return this; }
  update(row: Row) { this.op = "update"; this.patch = row; return this; }
  delete() { this.op = "delete"; return this; }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
  gte(k: string, v: number | string) { this.filters.push((r) => r[k] != null && (r[k] as number | string) >= v); return this; }
  lte(k: string, v: number | string) { this.filters.push((r) => r[k] != null && (r[k] as number | string) <= v); return this; }
  in(k: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[k])); return this; }
  is(k: string, v: null) { this.filters.push((r) => r[k] == v); return this; }
  or(expr: string) {
    const term = /ilike\.%(.+?)%/.exec(expr)?.[1]?.toLowerCase() ?? "";
    this.filters.push((r) => ["name", "owner_name", "city"].some((k) => String(r[k] ?? "").toLowerCase().includes(term)));
    return this;
  }
  order(k: string, o?: { ascending?: boolean }) { this.sortKey = k; this.asc = o?.ascending ?? true; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.single = true; return this; }

  private run() {
    if (this.op === "delete") {
      for (const r of rowsOf(this.table).filter((r) => this.filters.every((f) => f(r)))) dropped.add(rowKey(this.table, r));
      if (written[this.table]) written[this.table] = written[this.table].filter((r) => !dropped.has(rowKey(this.table, r)));
      return { data: null, error: null };
    }
    if (this.op === "update" && this.patch) {
      for (const r of rowsOf(this.table).filter((r) => this.filters.every((f) => f(r)))) Object.assign(r, this.patch);
      return { data: null, error: null };
    }
    let rows = rowsOf(this.table).filter((r) => this.filters.every((f) => f(r)));
    if (this.sortKey) {
      const k = this.sortKey;
      rows = [...rows].sort((a, b) => {
        if (a[k] == null) return 1;
        if (b[k] == null) return -1;
        return (a[k]! < b[k]! ? -1 : a[k]! > b[k]! ? 1 : 0) * (this.asc ? 1 : -1);
      });
    }
    rows = rows.slice(0, this.max);
    return { data: this.single ? rows[0] ?? null : rows, error: null };
  }

  then<T1, T2>(ok?: ((v: { data: unknown; error: null }) => T1 | PromiseLike<T1>) | null, bad?: ((e: unknown) => T2 | PromiseLike<T2>) | null) {
    return Promise.resolve(this.run()).then(ok, bad);
  }
}

export function demoClient() {
  return {
    from: (table: string) =>
      Object.assign(new Query(table), {
        insert: async (row: Row) => {
          const saved = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
          (written[table] ??= []).unshift(saved);
          return { error: null };
        },
        upsert: async (row: Row) => {
          const bag = (written[table] ??= []);
          const k = rowKey(table, row);
          const i = bag.findIndex((r) => rowKey(table, r) === k);
          const saved = { ...(i >= 0 ? bag[i] : {}), ...row, updated_at: new Date().toISOString() };
          if (i >= 0) bag[i] = saved;
          else bag.unshift(saved);
          return { error: null };
        },
      }),
    auth: {
      getUser: async () => ({ data: { user: { id: "00000000-0000-0000-0000-000000000000", email: "demo@example.com" } } }),
      exchangeCodeForSession: async () => ({}),
    },
  };
}

export const isDemo = () => process.env.NEXT_PUBLIC_SUPABASE_URL === "demo";
