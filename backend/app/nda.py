"""Mutual NDA fields as the LLM and the API see them, and the party model shared by every document."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Years = Literal[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]


class CamelModel(BaseModel):
    """Snake_case in Python, camelCase in JSON, matching the frontend's types."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Term(CamelModel):
    fixed: bool = Field(description="true for a fixed number of years, false for open-ended")
    years: Years = Field(description="Length in years; keep the previous value while open-ended")


class Party(CamelModel):
    name: str = Field(description="Signer's full name")
    title: str = Field(description="Signer's job title")
    company: str = Field(description="Company name")
    notice_address: str = Field(description="Email or postal address for legal notices")


EMPTY_PARTY = Party(name="", title="", company="", notice_address="")


class NdaFields(CamelModel):
    purpose: str = Field(description="How Confidential Information may be used")
    effective_date: str = Field(description='ISO date yyyy-mm-dd, or "" for today')
    mnda_term: Term = Field(description="Fixed years (1 to 10), or continues until terminated")
    confidentiality_term: Term = Field(description="Fixed years (1 to 10) from the effective date, or in perpetuity")
    governing_law: str = Field(description="State whose laws govern the MNDA, e.g. Delaware")
    jurisdiction: str = Field(description="Courts for disputes, e.g. courts located in New Castle, DE")
    modifications: str = Field(description='Changes to the Standard Terms, or "None" if the user wants none')
    party1: Party
    party2: Party


def default_fields() -> NdaFields:
    """Starting values; mirrors defaultFormData in frontend/lib/nda.ts."""
    return NdaFields(
        purpose="Evaluating whether to enter into a business relationship with the other party.",
        effective_date="",
        mnda_term=Term(fixed=True, years=1),
        confidentiality_term=Term(fixed=True, years=1),
        governing_law="",
        jurisdiction="",
        modifications="",
        party1=EMPTY_PARTY,
        party2=EMPTY_PARTY,
    )
