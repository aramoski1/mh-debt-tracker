export const STAGES = [
  ["target", "Target"],
  ["contacted", "Contacted"],
  ["in_conversation", "In conversation"],
  ["underwriting", "Underwriting"],
  ["loi", "LOI"],
  ["due_diligence", "Due diligence"],
  ["closed", "Closed"],
  ["passed", "Dead"],
] as const;

export type StageId = (typeof STAGES)[number][0] | "under_contract";

export const STAGE_LABEL: Record<string, string> = {
  ...Object.fromEntries(STAGES),
  under_contract: "Due diligence",
};

export const BOARD = STAGES.map(([id]) => id);

export function boardColumn(stage: string) {
  return stage === "under_contract" ? "due_diligence" : stage;
}
