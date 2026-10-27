// Demo mode: NEXT_PUBLIC_SUPABASE_URL=demo serves fictional parks from demo/data.json so the app can be
// tried before a Supabase project exists. Supports the small subset of the query API the app uses.
import data from "@/demo/data.json";

type Row = Record<string, unknown>;
const tables = data as unknown as Record<string, Row[]>;
const memoryNotes: Row[] = [];

class Query implements PromiseLike<{ data: unknown; error: null }> {
  private filters: ((r: Row) => boolean)[] = [];
  private sortKey: string | null = null;
  private asc = true;
  private max = Infinity;
  private single = false;

  constructor(private table: string) {}

  select() { return this; }
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
    const source = this.table === "activities" ? [...memoryNotes, ...(tables.activities ?? [])] : tables[this.table] ?? [];
    let rows = source.filter((r) => this.filters.every((f) => f(r)));
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
          memoryNotes.unshift({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row });
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
