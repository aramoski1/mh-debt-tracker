import { expect, type Locator, type Page, test } from "@playwright/test";

const GOLDEN_SUN = "/parks/4afc56da-ea0a-4cf9-b433-d7696eabeed1";
const SILVER_SPUR = "/parks/c9fb0d5d-d85f-4b91-8e84-921bb3413792";
const SAGUARO = "/parks/470e74b1-65a9-4b3c-9569-0c854cde6599";
const PARADISE = "/parks/ad423472-c660-4094-9560-78989e6bb64c";

const PARTS = [
  "Loan coming due",
  "Rate shock",
  "Coverage at today's rate",
  "Lender pressure",
  "Owner profile",
] as const;

function watchWrites(page: Page) {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(new URL(request.url()).pathname);
  });
  return posts;
}

function loanCard(page: Page) {
  return page.locator("section", { has: page.getByRole("heading", { name: "Next maturity" }) });
}

function fact(card: Locator, label: string) {
  return card.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");
}

function part(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("xpath=following-sibling::span[1]");
}

async function fillLabeled(page: Page, label: string, value: string) {
  await page.locator("label", { hasText: label }).locator("input").fill(value);
}

function fitScore(page: Page) {
  return page.getByText("Acquisition fit", { exact: true }).locator("xpath=preceding-sibling::div[1]");
}

test("today lists Golden Sun, and that park's loan is the reported May 2028 note", async ({ page }) => {
  const posts = watchWrites(page);
  await page.goto("/desk");
  const calls = page.locator("section", { has: page.getByRole("heading", { name: "Calls worth making" }) });
  const link = calls.getByRole("link", { name: "Golden Sun Mobile Home Park", exact: true });
  await expect(link).toHaveAttribute("href", GOLDEN_SUN);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${GOLDEN_SUN}$`));
  await expect(page.getByRole("heading", { name: "Golden Sun Mobile Home Park" })).toBeVisible();
  await expect(page.getByText("The loan is reported to come due May 2028.")).toBeVisible();
  const card = loanCard(page);
  await expect(fact(card, "Lender")).toHaveText("Commerce Bank of Arizona");
  await expect(fact(card, "Balance")).toHaveText("$2.5M");
  await expect(fact(card, "Rate")).toHaveText("3.56%");
  await expect(fact(card, "Payment")).toHaveText("—");
  await expect(page.getByText("The amortization was not on the loan, so the payment stays blank.")).toBeVisible();
  expect(posts).not.toContain("/api/underwriting");
  await expect(page.getByText("Saved on this park.")).toHaveCount(0);
});

test("Silver Spur shows one fit of 60 and owner pressure 45.5, with no cash gap", async ({ page }) => {
  await page.goto(SILVER_SPUR);
  await expect(page.getByText("Acquisition fit", { exact: true })).toHaveCount(1);
  await expect(fitScore(page)).toHaveText("60");
  const pressure = page.locator("span", { hasText: "High" }).filter({ hasText: "45.5" });
  await expect(pressure).toBeVisible();
  await expect(page.getByText("Owner pressure", { exact: true })).toBeVisible();
  await expect(part(page, "Loan coming due")).toHaveText("29.8 / 35");
  await expect(part(page, "Rate shock")).toHaveText("5.7 / 20");
  await expect(part(page, "Coverage at today's rate")).toHaveText("—");
  await expect(part(page, "Lender pressure")).toHaveText("2.0 / 10");
  await expect(part(page, "Owner profile")).toHaveText("8.0 / 15");
  const breakdown = page.locator("section", { has: page.getByRole("heading", { name: "Why the fit score is 60" }) });
  await expect(breakdown.locator("li span.num")).toHaveText(["25", "20", "15", "0", "0"]);
  await expect(fact(loanCard(page), "Balance")).toHaveText("—");
  await expect(page.getByText("Cash the owner must bring")).toHaveCount(0);
  await expect(page.getByText("The loan is documented through Sep 2027. Ask what they have lined up to replace it.", { exact: true })).toBeVisible();
});

test("a passed maturity is not written as a loan that is still coming due", async ({ page }) => {
  await page.goto("/parks/7241650e-b31c-441b-8764-9e6c3839a8d6");
  const village = page.locator("section", { has: page.getByText("Before you call") });
  await expect(village).toContainText("The Jul 2022 date has passed. The loan was most likely repaid without a recorded release.");
  await expect(village).not.toContainText("lined up");
  await page.goto("/parks/d14493f3-3dc0-4621-ba78-acf23d258f8f");
  const canyon = page.locator("section", { has: page.getByText("Before you call") });
  await expect(canyon).toContainText("The likely range, Sep 2023 to Sep 2026, has already passed. The date is a model, not a date to quote.");
  await expect(canyon).not.toContainText("come due");
});

test("Saguaro leaves the payment blank", async ({ page }) => {
  await page.goto(SAGUARO);
  const card = loanCard(page);
  await expect(fact(card, "Balance")).toHaveText("$1.1M");
  await expect(fact(card, "Rate")).toHaveText("4.91%");
  await expect(fact(card, "Payment")).toHaveText("—");
  await expect(page.getByText("The amortization was not on the loan, so the payment stays blank.")).toBeVisible();
});

test("Paradise has no loan score and one fit of 60", async ({ page }) => {
  await page.goto(PARADISE);
  await expect(page.getByRole("heading", { name: "Not scored — no loan on file.", exact: true })).toBeVisible();
  await expect(page.getByTitle("No score")).toContainText("—");
  await expect(page.getByText("Owner pressure", { exact: true })).toBeVisible();
  await expect(page.getByText("Acquisition fit", { exact: true })).toHaveCount(1);
  await expect(fitScore(page)).toHaveText("60");
  for (const label of PARTS) await expect(part(page, label)).toHaveText("—");
});

test("Saguaro underwriting stays unsaved and matches the desk case", async ({ page }) => {
  const posts = watchWrites(page);
  await page.goto(SAGUARO);
  await page.getByRole("tab", { name: "Underwriting" }).click();
  await fillLabeled(page, "Price", "6000000");
  await fillLabeled(page, "Cap rate %", "7.5");
  await fillLabeled(page, "Sites", "100");
  await fillLabeled(page, "Lot rent / month", "375");
  await fillLabeled(page, "Occupancy %", "100");
  await fillLabeled(page, "Expenses %", "0");
  await fillLabeled(page, "Rent growth % / year", "0");
  await fillLabeled(page, "New bank loan", "7");
  const tiles = page.locator("div", { has: page.getByText("Cash-on-cash", { exact: true }) });
  await expect(tiles.getByText("Cash-on-cash", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("6.05%");
  await expect(page.getByText("Equity before closing costs", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("$1,500,000");
  await expect(page.getByText("5-year IRR before selling costs", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("8.99%");
  const draft = page.getByRole("heading", { name: "Draft for review" }).locator("xpath=following-sibling::textarea");
  await expect(draft).toHaveValue(/year-1 NOI is \$450,000\./);
  await expect(draft).toHaveValue(/The new bank loan case is a 30-year desk loan at 7\.00%\. The loan amount is \$4,500,000, and 75% of price \(desk cap\) binds\./);
  await expect(draft).toHaveValue(/Cash-on-cash on those inputs is 6\.05%\./);
  await expect(draft).toHaveValue(/Equity is price minus the new loan, before closing costs\./);
  await expect(draft).toHaveValue(/The year-5 IRR, before selling costs, selling at the same 7\.5% cap rate, is 8\.99%\./);
  await expect(draft).not.toHaveValue(/4\.91/);
  await expect(draft).not.toHaveValue(/\$1,089,000/);
  await expect(draft).not.toHaveValue(/\$1\.1M/);
  await fillLabeled(page, "New bank loan", "0");
  await expect(draft).not.toHaveValue(/^Enter a price/);
  await expect(draft).toHaveValue(/a 30-year desk loan at 0\.00%\. The loan amount is \$4,500,000/);
  await expect(page.getByText("Cash-on-cash", { exact: true }).locator("xpath=following-sibling::p")).toHaveText("20.00%");
  expect(posts).not.toContain("/api/underwriting");
  await expect(page.getByText("Saved on this park.")).toHaveCount(0);
});

test("Golden Sun underwriting uses the figures left on the form", async ({ page }) => {
  const posts = watchWrites(page);
  await page.goto(GOLDEN_SUN);
  await page.getByRole("tab", { name: "Underwriting" }).click();
  await fillLabeled(page, "Price", "4000000");
  await fillLabeled(page, "Cap rate %", "8");
  await fillLabeled(page, "Lot rent / month", "400");
  await fillLabeled(page, "Rent growth % / year", "2");
  await fillLabeled(page, "New bank loan", "7");
  const draft = page.getByRole("heading", { name: "Draft for review" }).locator("xpath=following-sibling::textarea");
  await expect(draft).toHaveValue(/\$4,000,000/);
  await expect(draft).toHaveValue(/80 sites, \$400 lot rent, 90% occupancy and 40% expenses, year-1 NOI is \$207,360/);
  await expect(draft).toHaveValue(/30-year desk loan at 7\.00%/);
  expect(posts).not.toContain("/api/underwriting");
  await expect(page.getByText("Saved on this park.")).toHaveCount(0);
});

test("a blank owner balance stays blank, and the same recorded name stays a separate park", async ({ page }) => {
  await page.goto("/owners/eb4c1318-4fd1-45b3-97b9-79167ceb859e");
  await expect(page.getByRole("heading", { name: "Silver Spur Holdings LLC", exact: true })).toBeVisible();
  await expect(page.getByText("Debt on file", { exact: true }).locator("xpath=following-sibling::p[1]")).toHaveText("—");
  await expect(page.getByText("Recorded debt on the book is —.")).toBeVisible();
  await expect(page.getByText("$0")).toHaveCount(0);
  await expect(page.getByText("Parks", { exact: true }).locator("xpath=following-sibling::p[1]")).toHaveText("1");
  const same = page.locator("section", { has: page.getByRole("heading", { name: "Same recorded name" }) });
  await expect(same.getByRole("link", { name: "Silver Spur Manufactured Home Community", exact: true })).toHaveAttribute("href", "/parks/91e245d4-a308-47af-9f9d-6335b8c6fd53");
  await expect(same.getByText("Not a confirmed owner.")).toBeVisible();
  await expect(same.getByText(/\$/)).toHaveCount(0);

  await page.goto("/owners/e29d7cdb-38b1-4575-be59-1772d789a260");
  await expect(page.getByText("Debt on file", { exact: true }).locator("xpath=following-sibling::p[1]")).toHaveText("$3.2M");
  await expect(page.getByText("Recorded debt on the book is $3.2M.")).toBeVisible();
  await expect(page.getByText("balance not on file")).toHaveCount(0);
  const other = page.locator("section", { has: page.getByRole("heading", { name: "Same recorded name" }) });
  await expect(other.getByRole("link", { name: "Silver Spur RV Resort", exact: true })).toBeVisible();
  await expect(other.getByText(/\$/)).toHaveCount(0);

  await page.goto("/owners/9aa03b5f-4ee5-4034-b6bd-01cb91954ed1");
  await expect(page.getByText("No other park on this desk uses this recorded name.")).toBeVisible();
  await expect(page.getByText("Debt on file", { exact: true }).locator("xpath=following-sibling::p[1]")).toHaveText("$1.2M");

  await page.goto("/owners");
  const spur = page.locator("tr", { has: page.getByRole("link", { name: "Silver Spur Holdings LLC", exact: true }) });
  await expect(spur).toHaveCount(2);
  await expect(spur.nth(0).locator("td").last()).toHaveText("Silver Spur Manufactured Home Community");
  await expect(spur.nth(1).locator("td").last()).toHaveText("Silver Spur RV Resort");
  const sunrise = page.locator("tr", { has: page.getByRole("link", { name: "Sunrise Holdings LLC", exact: true }) });
  await expect(sunrise.first().locator("td").last()).toHaveText("2 other parks");
  await expect(page.locator("tr", { has: page.getByRole("link", { name: "Palo Verde Partners LLC", exact: true }) }).locator("td").last()).toHaveText("—");
});
