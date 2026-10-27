"""Build demo data for the web app's demo mode by running the real jobs over invented Arizona parks.

  python scripts/make_demo.py postgresql://... ../web/demo/data.json

All parks, owners and loans produced here are fictional. Nothing in the output is real data.
"""
from __future__ import annotations

import json
import random
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from mhdebt import db, jobs
from mhdebt.rates import RateCurve

random.seed(7)
TODAY = date.today()

CITIES = [("Mesa", 33.415, -111.83, "Maricopa"), ("Phoenix", 33.45, -112.07, "Maricopa"),
          ("Apache Junction", 33.415, -111.55, "Maricopa"), ("Glendale", 33.54, -112.19, "Maricopa"),
          ("Tucson", 32.22, -110.97, "Pima"), ("Casa Grande", 32.88, -111.76, "Pinal"),
          ("Yuma", 32.69, -114.63, "Yuma"), ("Lake Havasu City", 34.48, -114.32, "Mohave"),
          ("Prescott Valley", 34.61, -112.32, "Yavapai"), ("Quartzsite", 33.66, -114.23, "La Paz")]
WORDS = ["Desert", "Saguaro", "Palo Verde", "Mesquite", "Sunrise", "Cactus", "Canyon", "Ocotillo", "Shady",
         "Silver Spur", "Rancho", "Casa", "Paradise", "Copper", "Golden Sun", "Pueblo", "Vista", "Mountain View"]
SUFFIX = ["Mobile Home Park", "MHP", "Estates", "Village", "RV Resort", "Manufactured Home Community"]
LENDERS = [("Western Alliance Bank", "regional_bank", 260), ("Commerce Bank of Arizona", "community_bank", 340),
           ("Arizona Bank & Trust", "community_bank", 310), ("Desert Financial Credit Union", "credit_union", None),
           ("Walker & Dunlop", "agency_lender", None), ("The Hansen Family Trust", "individual", None),
           ("Alliance Bank of Arizona", "community_bank", 280), ("Pinnacle Debt Fund LLC", "debt_fund", None)]
OWNERS = ["{w} Holdings LLC", "{w} Communities LP", "Robert and Linda {l}", "{l} Family Trust", "{w} Partners LLC"]
LAST = ["Hansen", "Morales", "Whitaker", "Nguyen", "Kowalski", "Brennan", "Delgado", "Foster"]
OWNER_STATES = ["AZ", "AZ", "AZ", "CA", "CA", "WA", "IL", "CO"]


def main(url: str, out: Path) -> None:
    conn = db.connect(url)
    for i in range(48):
        city, lat, lon, county = random.choice(CITIES)
        w = random.choice(WORDS)
        suffix = random.choice(SUFFIX)
        kind = "rv" if "RV" in suffix else "mhp"
        units = random.choice([24, 38, 52, 64, 80, 96, 120, 150, 210, 260])
        pid = db.upsert_park_by_source(conn, "demo", str(i), {
            "name": f"{w} {suffix}", "address": f"{random.randint(100, 9900)} {random.choice(['E', 'W', 'N', 'S'])} "
            f"{random.choice(['Main St', 'Apache Trl', 'Broadway Rd', 'University Dr', 'Ajo Way', 'Baseline Rd'])}",
            "city": city, "state": "AZ", "zip": "85" + str(random.randint(100, 999)), "county": county,
            "lat": lat + random.uniform(-0.12, 0.12), "lon": lon + random.uniform(-0.15, 0.15), "kind": kind,
            "units": units})
        oname = random.choice(OWNERS).format(w=w, l=random.choice(LAST))
        ost = random.choice(OWNER_STATES)
        oid = db.upsert_owner(conn, oname, city="Scottsdale" if ost == "AZ" else "Los Angeles", state=ost,
                              zip_=str(random.randint(80000, 99999)))
        conn.execute("update parks set owner_id=%s where id=%s", (oid, pid))
        held = TODAY - timedelta(days=random.randint(3, 30) * 365)
        db.upsert_parcel(conn, {"county": county.lower(), "apn": f"DEMO-{i}", "state": "AZ", "park_id": pid,
                                "owner_name": oname, "last_sale_date": held})
        r = random.random()
        if r < 0.22:
            continue  # free and clear
        lender, lkind, cre = random.choice(LENDERS)
        lid = db.upsert_lender(conn, lender, lkind, cre_concentration=cre)
        start = held + timedelta(days=random.randint(0, max(1, (TODAY - held).days - 200)))
        amount = round(units * random.uniform(28_000, 52_000), -4)
        rec = {"park_id": pid, "lender_id": lid, "lender_name_raw": lender, "original_amount": amount,
               "origination_date": start, "recording_date": start, "property_state_raw": "AZ"}
        if r < 0.35:  # published loan with a known date (only loans still outstanding appear in these files)
            start = TODAY - timedelta(days=random.randint(400, 3300))
            years = next(y for y in random.sample([5, 7, 10], 3) + [10] if start + timedelta(days=y * 365) > TODAY - timedelta(days=150))
            rec.update(origination_date=start, recording_date=start,
                       maturity_date=start + timedelta(days=years * 365),
                       maturity_basis="reported", note_rate=round(random.uniform(3.4, 5.2), 2),
                       current_balance=round(amount * 0.9, -3))
            db.upsert_loan(conn, "cmbs", f"demo-{i}", rec)
        else:
            if random.random() < 0.3:
                rec.update(maturity_date=start + timedelta(days=5 * 365), maturity_basis="document")
            db.upsert_loan(conn, "county", f"demo-{i}", rec)
        if random.random() < 0.05:
            db.upsert_recorded_document(conn, {"county": county.lower(), "recording_number": f"DEMO-NTS-{i}",
                                               "doc_type": "trustee_sale_notice",
                                               "recording_date": TODAY - timedelta(days=20), "park_id": pid})
    conn.commit()
    jobs.build_county_loans(conn)
    jobs.estimate_maturities(conn, TODAY)
    jobs.score_parks(conn, RateCurve(), TODAY)

    overview = conn.execute("select * from park_overview order by score desc nulls last").fetchall()
    loans = conn.execute("""select l.*, json_build_object('name', ld.name, 'kind', ld.kind) as lenders,
                                   to_jsonb(me) as maturity_estimates
                            from loans l left join lenders ld on ld.id=l.lender_id
                            left join maturity_estimates me on me.loan_id=l.id""").fetchall()
    alerts = conn.execute("""select a.*, json_build_object('name', p.name, 'city', p.city) as parks
                             from alerts a left join parks p on p.id=a.park_id order by created_at desc""").fetchall()
    docs = conn.execute("select * from recorded_documents").fetchall()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"park_overview": overview, "loans": loans, "alerts": alerts,
                               "recorded_documents": docs, "activities": [], "parcels": []},
                              default=lambda v: float(v) if isinstance(v, Decimal) else str(v)))
    print(f"wrote {len(overview)} parks to {out}")


if __name__ == "__main__":
    main(sys.argv[1], Path(sys.argv[2]))
