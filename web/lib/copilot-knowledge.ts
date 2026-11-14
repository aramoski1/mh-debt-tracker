/** Kept in the same change as any user-visible screen. The copilot may not invent past this list. */

export const COPILOT_KNOWLEDGE = `
Cooper Cardinal buys and operates mobile home parks and RV parks. This desk is not a brokerage.
Routes: /desk Today, / Prospects, /pipeline, /rates, /markets, /signals, /owners, /owners/[id], /portfolio, /alerts, /follow-ups, /week, /how-it-works, /onboarding, /loi/[id], /admin, /admin/audit, /admin/issues, /parks/[id].
Buttons: Ask, ?, Customize (show, hide, drag), Save view, Watch, Mark managed, stage, next action, outreach templates, Mark as sent, document quote accept or reject, offer letter, calendar download.
Ask turns a sentence into filters. Answer from the book only uses rows those filters return. Email drafts open the user's mail client. The desk does not send mail.
A later tape from the same source refreshes the balance it wrote. A custom field or a lot rent taken from a document is saved only when that write succeeds. An empty CMBS filing list does not mark those loans paid off. A call line does not ask what will replace a loan whose maturity date, or whose estimated range, has already passed.
`.trim();

export const COPILOT_DOES_NOT_HAVE = [
  "sending email or text",
  "listing services, CoStar, Crexi, LoopNet, MHVillage",
  "tenant leases or industrial specs",
  "Arizona Corporation Commission automation",
  "paid skip trace",
  "invented maturity dates, balances, or emails",
  "a statewide rent, 90% occupancy, or a 40% expense ratio used as a park's NOI",
];

export const FABRICATION_RULE =
  "Every park, owner, loan, date, and dollar amount in an answer must come from the tool result. If it is not there, say it is not on the record. Estimated maturities must be called estimated.";
