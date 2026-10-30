import { callLine } from "./brief";
import type { ParkRow } from "./types";

/** A draft the broker pastes or opens in their own mail client. Built only from fields on the park. */
export function outreachDraft(park: ParkRow) {
  const to = park.email?.trim() || park.owner_email?.trim() || "";
  const where = [park.city, park.state].filter(Boolean).join(", ");
  const subject = where ? `${park.name}, ${where}` : park.name;
  const body = ["Hello,", "", callLine(park), "", "Cooper Cardinal"].join("\n");
  const href = to
    ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : null;
  return { to, subject, body, href };
}
