"use client";

import { useState } from "react";
import type { ParkRow } from "@/lib/types";
import ParkMap from "./ParkMap";
import ProspectTable from "./ProspectTable";

export default function Prospects({ rows }: { rows: ParkRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.6fr)]">
      <div className="relative z-0 h-96 overflow-hidden rounded-md border border-line xl:sticky xl:top-16 xl:h-[calc(100vh-8rem)]">
        <ParkMap rows={rows} highlight={hover} />
      </div>
      <ProspectTable rows={rows} onHover={setHover} />
    </div>
  );
}
