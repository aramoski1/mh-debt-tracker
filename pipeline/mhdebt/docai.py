"""Read recorded loan documents with Claude.

About 59% of recorded commercial loans have no maturity date in the county's index data, but many state it
inside the document itself (a "Maturity Date" definition, a balloon clause, or the note's terms recited in the
deed of trust). This module sends the scanned document to Claude and gets back structured fields with the
exact quote and page each value came from, so a broker can verify it.

Accepted inputs: a PDF, or page images (PNG/JPEG/TIFF; TIFF is converted to PNG with Pillow).
"""
from __future__ import annotations

import base64
import io
import json
from dataclasses import dataclass
from datetime import date

from .normalize import parse_date, parse_money

EXTRACTION_TOOL = {
    "name": "record_loan_terms",
    "description": "Record the loan terms found in a recorded mortgage, deed of trust, modification or release.",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_type": {"type": "string", "enum": [
                "deed_of_trust", "mortgage", "modification", "assignment", "release", "subordination", "ucc", "other"]},
            "lender_name": {"type": ["string", "null"], "description": "Beneficiary / mortgagee. Not the trustee."},
            "borrower_name": {"type": ["string", "null"], "description": "Trustor / mortgagor."},
            "trustee_name": {"type": ["string", "null"]},
            "loan_amount": {"type": ["number", "null"], "description": "Principal amount secured, in dollars."},
            "note_date": {"type": ["string", "null"], "description": "Date of the note or loan agreement, YYYY-MM-DD."},
            "maturity_date": {"type": ["string", "null"],
                              "description": "Final maturity date if stated or computable from stated terms, YYYY-MM-DD."},
            "maturity_is_computed": {"type": "boolean",
                                     "description": "True if derived from a stated term (e.g. 'due 60 months from the date of the note')."},
            "interest_rate_pct": {"type": ["number", "null"]},
            "rate_type": {"type": ["string", "null"], "enum": ["fixed", "variable", None]},
            "balloon": {"type": ["boolean", "null"]},
            "extension_options": {"type": ["string", "null"], "description": "Any extension rights, briefly."},
            "references_recording_number": {"type": ["string", "null"],
                                            "description": "For releases, modifications and assignments: the recording number of the original instrument."},
            "apns": {"type": "array", "items": {"type": "string"}, "description": "Assessor parcel numbers mentioned."},
            "is_mobile_home_or_rv_park": {"type": ["boolean", "null"]},
            "evidence": {
                "type": "array",
                "description": "One entry per field you filled: the field, the page number, and the exact words on the page.",
                "items": {"type": "object", "properties": {
                    "field": {"type": "string"}, "page": {"type": "integer"}, "quote": {"type": "string"}},
                    "required": ["field", "quote"]},
            },
            "notes": {"type": ["string", "null"]},
        },
        "required": ["document_type", "maturity_is_computed", "apns", "evidence"],
    },
}

SYSTEM = """You read scanned county-recorded real estate loan documents for a commercial real estate brokerage.
Extract only what the document actually says. Never guess a maturity date from typical loan terms: if the
document does not state a maturity date or a term you can compute it from, return null. Deeds of trust often
recite the note's maturity ("which Note matures on...", "due and payable on...", "Maturity Date"); also check
riders and exhibits. Quote the exact words for every value you return. Dates as YYYY-MM-DD."""


@dataclass
class Extraction:
    data: dict
    maturity_date: date | None
    note_date: date | None
    loan_amount: float | None
    rate: float | None
    input_tokens: int
    output_tokens: int


def _image_blocks(images: list[bytes]) -> list[dict]:
    blocks = []
    for img in images:
        media = "image/png"
        if img[:2] == b"\xff\xd8":
            media = "image/jpeg"
        elif img[:4] in (b"II*\x00", b"MM\x00*"):
            from PIL import Image  # TIFF is not accepted by the API; convert each frame to PNG

            tif = Image.open(io.BytesIO(img))
            for i in range(getattr(tif, "n_frames", 1)):
                tif.seek(i)
                out = io.BytesIO()
                tif.convert("L").save(out, format="PNG", optimize=True)
                blocks.append({"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                           "data": base64.standard_b64encode(out.getvalue()).decode()}})
            continue
        blocks.append({"type": "image", "source": {"type": "base64", "media_type": media,
                                                   "data": base64.standard_b64encode(img).decode()}})
    return blocks


def extract(client, model: str, *, pdf: bytes | None = None, images: list[bytes] | None = None,
            context: str = "") -> Extraction:
    """`client` is an anthropic.Anthropic instance. Pass either a PDF or page images."""
    if pdf is not None:
        content: list[dict] = [{"type": "document", "source": {
            "type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(pdf).decode()}}]
    elif images:
        content = _image_blocks(images)
    else:
        raise ValueError("need pdf or images")
    content.append({"type": "text", "text": "Extract the loan terms from this recorded document."
                    + (f"\nIndex data from the county for reference: {context}" if context else "")})
    msg = client.messages.create(
        model=model,
        max_tokens=2000,
        system=SYSTEM,
        tools=[EXTRACTION_TOOL],
        tool_choice={"type": "tool", "name": "record_loan_terms"},
        messages=[{"role": "user", "content": content}],
    )
    data = next((b.input for b in msg.content if getattr(b, "type", "") == "tool_use"), {})
    if isinstance(data, str):
        data = json.loads(data)
    return Extraction(
        data=data,
        maturity_date=parse_date(data.get("maturity_date")),
        note_date=parse_date(data.get("note_date")),
        loan_amount=parse_money(data.get("loan_amount")),
        rate=data.get("interest_rate_pct"),
        input_tokens=getattr(msg.usage, "input_tokens", 0),
        output_tokens=getattr(msg.usage, "output_tokens", 0),
    )


def trustworthy_maturity(x: Extraction) -> date | None:
    """Accept a maturity date only if the model quoted evidence for it and it's plausible."""
    if not x.maturity_date:
        return None
    if not any(e.get("field") == "maturity_date" and e.get("quote") for e in x.data.get("evidence", [])):
        return None
    if x.note_date and not (x.note_date < x.maturity_date <= date(x.note_date.year + 40, 12, 31)):
        return None
    return x.maturity_date


NOTE_TOOL = {
    "name": "record_call_facts",
    "description": "Structured facts from a broker's call note with a park owner.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "outcome": {"type": "string", "enum": ["no_answer", "not_interested", "interested", "listing", "refi_referral", "other"]},
            "next_follow_up": {"type": ["string", "null"], "description": "YYYY-MM-DD if a date or timeframe was given"},
            "lender_mentioned": {"type": ["string", "null"]},
            "maturity_mentioned": {"type": ["string", "null"], "description": "YYYY-MM-DD or YYYY-MM"},
            "rate_mentioned_pct": {"type": ["number", "null"]},
            "balance_mentioned": {"type": ["number", "null"]},
            "motivation": {"type": ["string", "null"], "description": "Why they might sell: retirement, estate, refi, fatigue..."},
            "asking_price": {"type": ["number", "null"]},
        },
        "required": ["summary", "outcome"],
    },
}


def structure_call_note(client, model: str, note: str, today: date) -> dict:
    """Turn a dictated call note into fields that update the owner and loan records."""
    msg = client.messages.create(
        model=model, max_tokens=600, tools=[NOTE_TOOL], tool_choice={"type": "tool", "name": "record_call_facts"},
        messages=[{"role": "user", "content": f"Today is {today.isoformat()}. Broker's call note:\n\n{note}"}],
    )
    return next((b.input for b in msg.content if getattr(b, "type", "") == "tool_use"), {})
