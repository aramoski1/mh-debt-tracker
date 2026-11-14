import { afterEach, describe, expect, it } from "vitest";
import { monthsFromNow, now } from "./format";

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

describe("demo clock", () => {
  it("uses the pinned calendar day, not today", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "demo";
    process.env.DEMO_AS_OF = "2026-11-12";
    const clock = now();
    expect(clock.getFullYear()).toBe(2026);
    expect(clock.getMonth()).toBe(10);
    expect(clock.getDate()).toBe(12);
    expect(monthsFromNow("2028-05-12")).toBe(18);
    expect(monthsFromNow("2027-09-25")).toBe(10);
  });

  it("ignores the pin outside demo mode", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.DEMO_AS_OF = "2020-01-01";
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(5000);
    const real = new Date();
    const expected = (2028 - real.getFullYear()) * 12 + (5 - 1 - real.getMonth());
    expect(monthsFromNow("2028-05-12")).toBe(expected);
  });
});
