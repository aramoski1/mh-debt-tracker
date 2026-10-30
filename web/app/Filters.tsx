type SP = Record<string, string | undefined>;

const Select = ({ name, value, options }: { name: string; value?: string; options: [string, string][] }) => (
  <select name={name} defaultValue={value ?? ""} className="h-8 rounded-sm border border-line bg-panel px-2">
    {options.map(([v, l]) => (
      <option key={v} value={v}>
        {l}
      </option>
    ))}
  </select>
);

// A plain GET form: filters live in the URL, so any view can be bookmarked or shared with the team.
export default function Filters({ current }: { current: SP }) {
  return (
    <form className="flex flex-wrap items-end gap-2 rounded-sm border border-line bg-panel p-3">
      {current.city && <input type="hidden" name="city" value={current.city} />}
      {current.owner && <input type="hidden" name="owner" value={current.owner} />}
      {current.minParks && <input type="hidden" name="minParks" value={current.minParks} />}
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">Search</span>
        <input id="desk-search" name="q" defaultValue={current.q} placeholder="Park, owner or city"
               className="h-8 w-56 rounded-sm border border-line px-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">State</span>
        <input name="state" defaultValue={current.state ?? "AZ"} className="h-8 w-14 rounded-sm border border-line px-2 uppercase" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">Type</span>
        <Select name="kind" value={current.kind}
                options={[["", "All"], ["mhp", "MH parks"], ["rv", "RV parks"], ["mixed", "MH + RV"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">Sites</span>
        <div className="flex items-center gap-1">
          <input name="minUnits" defaultValue={current.minUnits} placeholder="min" className="h-8 w-16 rounded-sm border border-line px-2" />
          <span className="text-muted">to</span>
          <input name="maxUnits" defaultValue={current.maxUnits} placeholder="max" className="h-8 w-16 rounded-sm border border-line px-2" />
        </div>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">Matures within</span>
        <Select name="window" value={current.window}
                options={[["", "Any time"], ["6", "6 months"], ["12", "12 months"], ["18", "18 months"], ["24", "24 months"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">Lender</span>
        <Select name="lender" value={current.lender}
                options={[["", "Any"], ["bank", "Banks and credit unions"], ["agency", "Fannie / Freddie"],
                          ["cmbs", "CMBS"], ["private", "Private / seller"], ["none", "No loan found"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">Maturity</span>
        <Select name="basis" value={current.basis} options={[["", "Known or estimated"], ["known", "Known dates only"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">County</span>
        <input name="county" defaultValue={current.county} placeholder="Maricopa" className="h-8 w-28 rounded-sm border border-line px-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">Notice</span>
        <Select name="status" value={current.status} options={[["", "Any"], ["foreclosure", "Foreclosure"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-wide text-muted">Min score</span>
        <input name="minScore" defaultValue={current.minScore} className="h-8 w-16 rounded-sm border border-line px-2" />
      </label>
      <button className="h-8 rounded-sm bg-accent px-4 font-medium text-on-accent hover:bg-accent-hover">Apply</button>
      <a href="/" className="h-8 px-2 leading-8 text-muted hover:text-fg">Reset</a>
      {(current.city || current.owner || current.minParks) && (
        <p className="w-full text-xs text-muted">
          {[current.city && `City ${current.city}`, current.owner === "out" && "Owner outside Arizona", current.minParks && `Owner has at least ${current.minParks} parks`].filter(Boolean).join(" · ")}
        </p>
      )}
    </form>
  );
}
