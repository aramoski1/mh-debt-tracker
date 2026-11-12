export type Guide = { route: string; title: string; purpose: string; steps: string[] };

export const GUIDES: Guide[] = [
  { route: "/desk", title: "Today", purpose: "What to work this morning, ranked so a trustee sale comes before a reminder.", steps: ["Read the top row and open the park.", "Hide a block from Customize if you do not use it.", "Ask a question in the box. The answer uses only parks on the book."] },
  { route: "/", title: "Prospects", purpose: "The Arizona book, filtered.", steps: ["Type a sentence such as banks in Tucson due in 12 months.", "Save view keeps that filter.", "j and k move the table. Enter opens the park.", "A park with no loan has no score. The cash gap stays blank until a reported NOI is on the loan."] },
  { route: "/parks", title: "Park", purpose: "One park: why it scores, the loan, the owner, and the next action.", steps: ["Read the call line before you dial.", "The email draft does not send mail.", "A maturity marked Estimated is a model, not a document.", "Coverage stays blank until a reported NOI is on the loan. The balance is the current balance. One fit score sits in the header."] },
  { route: "/pipeline", title: "Pipeline", purpose: "Deals you are working, with a probability-weighted price.", steps: ["Drag a card to change stage.", "Set diligence and close dates. They show on Today.", "The forecast ignores Dead."] },
  { route: "/follow-ups", title: "Follow-ups", purpose: "Next actions and note follow-ups.", steps: ["Overdue is anything before today.", "Snooze moves the date seven days."] },
  { route: "/week", title: "This week", purpose: "A call list and how many you have logged.", steps: ["The target is the number of calls, not a dollar quota."] },
  { route: "/owners", title: "Owners", purpose: "Every park on the book under one recorded name.", steps: ["Open the dossier for debt, the next maturity, and the mailing address.", "Look up an LLC on the Arizona Corporation Commission site yourself. Paste what you find."] },
  { route: "/how-it-works", title: "Honest limits", purpose: "What this desk will not pretend to know.", steps: ["Most county-loan maturities are estimated.", "Rent is blank until someone enters it.", "About a third of parks have an owner name. About 13 percent have any loan."] },
];

export function guideFor(path: string) {
  if (path.startsWith("/parks/")) return GUIDES.find((g) => g.route === "/parks") ?? GUIDES[0];
  if (path.startsWith("/owners/")) return GUIDES.find((g) => g.route === "/owners") ?? GUIDES[0];
  return GUIDES.find((g) => g.route === path) ?? GUIDES[GUIDES.length - 1];
}
