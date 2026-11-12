import { scoreLabel, scoreTone } from "@/lib/format";

export function ScorePill({ score }: { score: number | null | undefined }) {
  const label = scoreLabel(score);
  return (
    <span title={label} className={`num inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-sm font-semibold ${scoreTone(score)}`}>
      <span>{score == null ? "—" : Number(score).toFixed(1)}</span>
      <span className="text-xs font-medium">{label}</span>
    </span>
  );
}
