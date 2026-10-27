from datetime import date
from pathlib import Path

from mhdebt.sources.edgar_cmbs import _ChainedStream, parse_ex102, parse_form_index, quarters_back

FIX = Path(__file__).parent / "fixtures"


def test_parse_ex102_keeps_only_park_loans_in_state():
    loans = list(parse_ex102((FIX / "exh_102_sample.xml").read_bytes(), "1752363", "TEST 2019-C1", states=["AZ"]))
    assert [l.asset_number for l in loans] == ["14", "31"]

    mh = loans[0]
    assert mh.maturity_date == date(2026, 12, 6)
    assert mh.origination_date == date(2019, 11, 20)
    assert mh.original_rate == 4.15
    assert mh.current_balance == 7412233.18
    assert mh.balloon is True
    assert len(mh.properties) == 2
    p = mh.properties[0]
    assert (p.name, p.city, p.units, p.dscr_noi_current, p.occupancy) == ("Sunrise Mobile Home Park", "Mesa", 142, 1.46, 95.0)

    rv = loans[1]  # coded OT, kept because the name says RV resort
    assert rv.properties[0].type_code == "OT"
    assert rv.payment_status == "5"


def test_parse_ex102_all_states():
    loans = list(parse_ex102((FIX / "exh_102_sample.xml").read_bytes(), "1", "T", states=None))
    assert {l.asset_number for l in loans} == {"14", "31", "40"}


def test_streaming_wrapper_parses_same_as_bytes():
    data = (FIX / "exh_102_sample.xml").read_bytes()
    chunks = iter([data[i:i + 97] for i in range(200, len(data), 97)])
    loans = list(parse_ex102(_ChainedStream(data[:200], chunks), "1", "T", states=["AZ"]))
    assert len(loans) == 2


def test_form_index_parsing():
    text = (
        "Form Type   Company Name                                                  CIK         Date Filed  File Name\n"
        "---------------------------------------------------------------------------------------------------------\n"
        "ABS-EE      BANK 2019-BNK19                                               1781297     2026-09-27  edgar/data/1781297/0001888524-26-014576.txt\n"
        "10-D        BANK 2019-BNK19                                               1781297     2026-09-27  edgar/data/1781297/0001888524-26-014575.txt\n"
    )
    filings = list(parse_form_index(text))
    assert len(filings) == 1
    f = filings[0]
    assert f.company == "BANK 2019-BNK19" and f.cik == "1781297" and f.filed == date(2026, 9, 27)
    assert f.folder.endswith("/edgar/data/1781297/000188852426014576")


def test_quarters_back():
    assert quarters_back(date(2026, 2, 1), 3) == [(2026, 1), (2025, 4), (2025, 3)]
