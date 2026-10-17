"""The supported documents (documents.json joined with catalog.json) and the LLM schemas built from them."""

import json
import os
from functools import cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, create_model

from app import nda
from app.nda import CamelModel, NdaFields, Party

ROOT = Path(os.environ.get("DOCUMENTS_ROOT", Path(__file__).parents[2]))
STRICT = ConfigDict(extra="forbid")
EMPTY_PARTY = Party(name="", title="", company="", notice_address="")

REPLY = Field(
    description="Message to show the user. While a document is not chosen or any detail is missing, "
    "it MUST end with one question about the next missing detail."
)


class FieldDef(BaseModel):
    key: str
    label: str
    description: str


class DocumentDef(CamelModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    description: str
    template: str
    cover_page: str | None = None
    parties: tuple[str, str]
    fields: list[FieldDef]


def _load() -> dict[str, DocumentDef]:
    catalog = {Path(t["filename"]).name: t for t in json.loads((ROOT / "catalog.json").read_text())["templates"]}
    entries = json.loads((ROOT / "documents.json").read_text())["documents"]
    return {
        e["id"]: DocumentDef.model_validate({**catalog[e["template"]], **e})
        for e in entries
    }


DOCUMENTS = _load()
DocumentId = Literal[tuple(DOCUMENTS)]


class Parties(BaseModel):
    """What is recorded before a document is chosen."""

    model_config = STRICT
    party1: Party
    party2: Party


@cache
def fields_model(document: str | None) -> type[BaseModel]:
    """The fields the LLM fills in for a document: parties plus its key terms."""
    if document is None:
        return Parties
    doc = DOCUMENTS[document]
    if doc.cover_page:
        return NdaFields
    first, second = doc.parties
    terms = {f.key: (str, Field(description=f"{f.label}: {f.description}")) for f in doc.fields}
    return create_model(
        f"{document.replace('-', '_')}_fields",
        __config__=STRICT,
        party1=(Party, Field(description=f"The {first}")),
        party2=(Party, Field(description=f"The {second}")),
        **terms,
    )


def default_fields(document: str | None) -> BaseModel:
    if document is None:
        return Parties(party1=EMPTY_PARTY, party2=EMPTY_PARTY)
    if DOCUMENTS[document].cover_page:
        return nda.default_fields()
    blank = {f.key: "" for f in DOCUMENTS[document].fields}
    return fields_model(document)(party1=EMPTY_PARTY, party2=EMPTY_PARTY, **blank)


@cache
def turn_model(document: str | None) -> type[BaseModel]:
    """One assistant turn: the (possibly new) document, the fields for the current one, and the reply."""
    if document is None:
        chosen = (DocumentId | None, Field(description="Id of the document the user wants, or null until agreed"))
    else:
        chosen = (DocumentId, Field(description="The current id; another id switches to that document"))
    return create_model(
        f"{(document or 'choose').replace('-', '_')}_turn",
        __config__=STRICT,
        document=chosen,
        fields=(fields_model(document), ...),
        reply=(str, REPLY),
    )
