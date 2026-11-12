import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { acquisitionFit } from "./fit";
import { balanceAfter, paymentMonths, scenario } from "./underwrite";

const fix = JSON.parse(readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../../pipeline/tests/fixtures/golden_parks.json"),
  "utf8",
));

function close(got: number, exp: number, tol: number, label: string) {
  expect(Math.abs(got - exp), label).toBeLessThanOrEqual(tol);
}

describe("golden file", () => {
  it("matches the Python payment", () => {
    for (const row of fix.payments) {
      close(paymentMonths(row.principal, row.rate, row.months), row.expected, 0.05, `payment ${row.months}`);
    }
  });

  it("matches the Python balance when both use the same term", () => {
    for (const row of fix.balances) {
      const amortYears = row.amort_months <= 0 ? 0 : row.amort_months / 12;
      close(
        balanceAfter(row.principal, row.rate, row.months_paid / 12, amortYears),
        row.expected,
        1,
        `balance ${row.amort_months}`,
      );
    }
  });

  it("matches the Python acquisition case", () => {
    for (const row of fix.scenarios) {
      const got = scenario({
        price: row.price,
        sites: row.sites,
        lotRent: row.lot_rent,
        occupancy: row.occupancy,
        expense: row.expense_ratio,
        capRate: row.cap_rate_pct,
        growth: row.rent_growth,
        rate: row.annual_rate_pct,
      });
      expect(got.ok).toBe(true);
      expect(got.binding).toBe(row.expected.binding);
      close(got.noi ?? 0, row.expected.noi, 1, "noi");
      close(got.loan ?? 0, row.expected.loan, 1, "loan");
      close(got.equity ?? 0, row.expected.equity, 1, "equity");
      close(got.exitValue ?? 0, row.expected.exit_value, 1, "exit");
      close(got.cashOnCash ?? 0, row.expected.cash_on_cash, 0.01, "cash");
      close(got.irr ?? 0, row.expected.irr, 0.01, "irr");
    }
  });

  it("gives the rate points when the note is exactly half a point inside", () => {
    const got = acquisitionFit({
      units: 120, state: "AZ", kind: "mhp", noteRate: 6.5, marketRate: 7, kmToManaged: null,
    });
    expect(got.points).toBe(80);
  });

  it("matches the Python fit score", () => {
    for (const row of fix.fit) {
      const got = acquisitionFit({
        units: row.units,
        state: row.state,
        kind: row.kind,
        noteRate: row.note_rate,
        marketRate: row.market_rate,
        kmToManaged: row.km_to_managed,
      });
      expect(got.points).toBe(row.expected);
    }
  });
});
