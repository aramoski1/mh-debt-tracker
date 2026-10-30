/** Public pages for a source key. Only URLs the pipeline already calls. */

const ASSESSOR = "https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0/query";
const RECORDER = "https://publicapi.recorder.maricopa.gov/documents";
const EDGAR = "https://www.sec.gov/Archives/edgar/data";

export function verifyHref(ref: string | null | undefined): string | null {
  if (!ref || !ref.includes(":")) return null;
  const prefix = ref.slice(0, ref.indexOf(":"));
  const id = ref.slice(ref.indexOf(":") + 1).trim();
  if (!id || id.includes(" ") || id.includes("'")) return null;
  if (prefix === "mcrec") return `${RECORDER}/${encodeURIComponent(id)}`;
  if (prefix === "mcao") {
    return `${ASSESSOR}?where=APN%3D%27${encodeURIComponent(id)}%27&outFields=APN,OWNER_NAME,SALE_DATE,SALE_PRICE&f=html`;
  }
  if (prefix === "edgar" && id.includes("/")) {
    const [cik, accession] = id.split("/");
    if (!/^\d+$/.test(cik) || !accession) return null;
    return `${EDGAR}/${cik}/${accession.replace(/-/g, "")}/`;
  }
  return null;
}
