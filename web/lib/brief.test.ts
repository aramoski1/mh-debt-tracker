import { describe, expect, it } from "vitest";
import { callLine } from "./brief";
import type { ParkRow } from "./types";

function row(over: Partial<ParkRow>): ParkRow {
  return { maturity_date: null, loan_status: "active", score_components: null, ...over } as ParkRow;
}

describe("call line", () => {
  it("names a price cap instead of an income shortfall", () => {
    const line = callLine(row({
      score_components: {
        refi_gap: {
          points: 0,
          scored: true,
          noi_basis: "reported",
          balance_basis: "reported",
          equity_needed: 750000,
          why: "25-year bank amortization. 75% of price (desk cap) binds",
        },
      },
    }));
    expect(line).toContain("$750,000");
    expect(line).toContain("price cap");
    expect(line).not.toContain("short about");
  });

  it("names an income shortfall when the DSCR test binds", () => {
    const line = callLine(row({
      score_components: {
        refi_gap: {
          points: 12.3,
          scored: true,
          noi_basis: "reported",
          balance_basis: "reported",
          equity_needed: 755393,
          why: "25-year bank amortization. 1.25x DSCR binds",
        },
      },
    }));
    expect(line).toContain("$755,393");
    expect(line).toContain("reported income");
  });
});
