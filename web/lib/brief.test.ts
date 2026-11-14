import { afterEach, describe, expect, it } from "vitest";
import { callLine } from "./brief";
import type { ParkRow } from "./types";

function row(over: Partial<ParkRow>): ParkRow {
  return { maturity_date: null, loan_status: "active", score_components: null, ...over } as ParkRow;
}

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

function pin() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "demo";
  process.env.DEMO_AS_OF = "2026-11-12";
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

  it("does not ask for a replacement when the note says the loan was most likely repaid", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2022-07-05",
      maturity_basis: "document",
      maturity_explanation: "Maturity 2022-07-05 (stated in the recorded document). The date passed long ago; the loan was most likely repaid without a recorded release.",
    }));
    expect(line).toBe("The Jul 2022 date has passed. The loan was most likely repaid without a recorded release.");
    expect(line).not.toContain("lined up");
    expect(line).not.toContain("come due");
  });

  it("does not quote a coming-due date when the estimated range has passed", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2026-09-01",
      maturity_basis: "estimated",
      p10_date: "2023-09-01",
      p90_date: "2026-09-01",
      maturity_explanation: "Most likely maturity 2026-09-01. There is about a 74% chance it was already repaid or refinanced without a release in our data.",
    }));
    expect(line).toBe("The likely range, Sep 2023 to Sep 2026, has already passed. The date is a model, not a date to quote.");
    expect(line).not.toContain("come due");
  });

  it("does not call a passed point date coming due while the range still runs ahead", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2026-09-01",
      maturity_basis: "estimated",
      p10_date: "2026-06-01",
      p90_date: "2027-03-01",
    }));
    expect(line).toBe("The Sep 2026 point date has passed. The likely range runs through Mar 2027. The date is a model, not a date to quote.");
    expect(line).not.toContain("come due");
  });

  it("still asks about a replacement when the documented date is ahead", () => {
    pin();
    const line = callLine(row({
      maturity_date: "2027-09-25",
      maturity_basis: "document",
      maturity_explanation: "Maturity 2027-09-25 (stated in the recorded document).",
    }));
    expect(line).toBe("The loan is documented through Sep 2027. Ask what they have lined up to replace it.");
  });

  it("keeps the trustee-sale sentence when the maturity has also passed", () => {
    pin();
    const line = callLine(row({
      loan_status: "foreclosure",
      maturity_date: "2022-07-05",
      maturity_basis: "document",
      maturity_explanation: "The date passed long ago; the loan was most likely repaid without a recorded release.",
    }));
    expect(line).toBe("A trustee sale or lis pendens is on the record. Ask if they want a buyer before the sale date.");
  });
});
