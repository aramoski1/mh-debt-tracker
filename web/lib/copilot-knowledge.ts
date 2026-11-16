/** Kept in the same change as any user-visible screen. The copilot may not invent past this list. */

export const COPILOT_KNOWLEDGE = `
Cooper Cardinal buys and operates mobile home parks and RV parks. This desk is not a brokerage.
Routes: /desk Today, / Prospects, /pipeline, /rates, /markets, /signals, /owners, /owners/[id], /portfolio, /alerts, /follow-ups, /week, /how-it-works, /onboarding, /loi/[id], /admin, /admin/audit, /admin/issues, /parks/[id].
Buttons: Ask, ?, Customize (show, hide, drag), Save view, Watch, Mark managed, stage, next action, outreach templates, Mark as sent, document quote accept or reject, offer letter, calendar download.
Ask turns a sentence into filters. Answer from the book only uses rows those filters return. Email drafts open the user's mail client. The desk does not send mail.
A later tape from the same source refreshes the balance it wrote. A custom field or a lot rent taken from a document is saved only when that write succeeds. An empty CMBS filing list does not mark those loans paid off. A call line does not ask what will replace a loan whose maturity date, or whose estimated range, has already passed. Documented means the date was read from a recorded document. A lender or servicer report inside twelve months says reported to come due, and the ask stays the same. An owner dossier leaves a blank balance blank. Next maturity is only a month still ahead. A passed date stays under Passed. The basis is Reported, From document, or Estimated. Parks that only share a recorded name are listed as the same name, not as one confirmed owner, and their balances are not added. A park is not in the pipeline until a stage is saved. The control says Not in the pipeline, and a next-action date does not create a Target by itself. On the park, Next maturity is only a month still ahead. A passed date is labeled Passed. A park with no loan says No loan found. A call line that would only say how long the owner has held the park says the loan fact instead. No loan on file says no loan is on file. A distress or sale row names the park and links to it. A bank note loaded from a county record says County record. A filing reads County record, CMBS filing, Fannie Mae, Freddie Mac, SBA, or FHA. Anything else says Source not labeled. It is not labeled with the raw source code.
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
