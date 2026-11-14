# Park Debt Tracker

Finds mobile home and RV parks whose loans are coming due, estimates when, and scores how much pressure each owner is under, so Cooper Cardinal can pursue the right parks for its own portfolio. Built on free public data; Arizona first. A nightly load still stores a park when its phone, website, or another nullable park field is blank. The park name is required. A later filing from the same source refreshes the balance it already stored. An empty CMBS filing list does not mark those loans paid off.

- `pipeline/`: Python ingestion and modeling (`mhdebt` CLI), runs nightly on GitHub Actions
- `supabase/`: Postgres schema with row-level security
- `web/`: Next.js app (map, ranked prospects, park pages, call notes, alerts)

Start with **[BUILD_GUIDE.md](BUILD_GUIDE.md)**.

Quick look without any setup:

```bash
cd web && npm install
echo "NEXT_PUBLIC_SUPABASE_URL=demo" > .env.local && echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=demo" >> .env.local
npm run dev
```

The demo shows fictional parks, owners and loans.

Tests: `cd pipeline && pip install -e ".[dev]" && pytest -q`. The demo desk check is `cd web && npm run e2e`. It pins the date to 2026-11-12 and does not sign in or save a case.
