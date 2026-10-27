type SP = Record<string, string | undefined>;

const Select = ({ name, value, options }: { name: string; value?: string; options: [string, string][] }) => (
  <select name={name} defaultValue={value ?? ""} className="h-8 rounded border border-stone-300 bg-white px-2">
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
    <form className="flex flex-wrap items-end gap-2 rounded border border-stone-200 bg-white p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-stone-500">Search</span>
        <input name="q" defaultValue={current.q} placeholder="Park, owner or city"
               className="h-8 w-56 rounded border border-stone-300 px-2" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-stone-500">State</span>
        <input name="state" defaultValue={current.state ?? "AZ"} className="h-8 w-14 rounded border border-stone-300 px-2 uppercase" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-stone-500">Type</span>
        <Select name="kind" value={current.kind}
                options={[["", "All"], ["mhp", "MH parks"], ["rv", "RV parks"], ["mixed", "MH + RV"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-stone-500">Sites</span>
        <div className="flex items-center gap-1">
          <input name="minUnits" defaultValue={current.minUnits} placeholder="min" className="h-8 w-16 rounded border border-stone-300 px-2" />
          <span className="text-stone-400">to</span>
          <input name="maxUnits" defaultValue={current.maxUnits} placeholder="max" className="h-8 w-16 rounded border border-stone-300 px-2" />
        </div>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-stone-500">Matures within</span>
        <Select name="window" value={current.window}
                options={[["", "Any time"], ["6", "6 months"], ["12", "12 months"], ["18", "18 months"], ["24", "24 months"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-stone-500">Lender</span>
        <Select name="lender" value={current.lender}
                options={[["", "Any"], ["bank", "Banks and credit unions"], ["agency", "Fannie / Freddie"],
                          ["cmbs", "CMBS"], ["private", "Private / seller"], ["none", "No loan found"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-stone-500">Maturity</span>
        <Select name="basis" value={current.basis} options={[["", "Known or estimated"], ["known", "Known dates only"]]} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-stone-500">Min score</span>
        <input name="minScore" defaultValue={current.minScore} className="h-8 w-16 rounded border border-stone-300 px-2" />
      </label>
      <button className="h-8 rounded bg-stone-900 px-4 font-medium text-white hover:bg-stone-700">Apply</button>
      <a href="/" className="h-8 px-2 leading-8 text-stone-500 hover:text-stone-900">Reset</a>
    </form>
  );
}
