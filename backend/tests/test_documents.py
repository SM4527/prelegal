import json
import re

import pytest

from app.documents import DOCUMENTS, ROOT, default_fields, fields_model, turn_model

GENERIC = [d for d in DOCUMENTS.values() if not d.cover_page]


def strict_violations(schema: dict) -> list[str]:
    """Places where a JSON schema breaks Groq strict mode: objects must forbid extra keys and require every key."""
    problems = []

    def walk(node, path):
        if isinstance(node, dict):
            if "properties" in node:
                if node.get("additionalProperties") is not False:
                    problems.append(f"{path}: additionalProperties")
                if set(node.get("required", [])) != set(node["properties"]):
                    problems.append(f"{path}: required")
            for key, value in node.items():
                walk(value, f"{path}/{key}")
        elif isinstance(node, list):
            for i, value in enumerate(node):
                walk(value, f"{path}[{i}]")

    walk(schema, "#")
    return problems


def test_every_catalog_template_is_a_document():
    catalog = {t["filename"].removeprefix("templates/") for t in json.loads((ROOT / "catalog.json").read_text())["templates"]}
    used = {d.template for d in DOCUMENTS.values()} | {d.cover_page for d in DOCUMENTS.values() if d.cover_page}
    assert used == catalog


def test_documents_take_name_and_description_from_the_catalog():
    assert DOCUMENTS["csa"].name == "Cloud Service Agreement"
    assert DOCUMENTS["baa"].description.startswith("Standard Terms for HIPAA compliance")


def test_template_files_exist():
    for doc in DOCUMENTS.values():
        assert (ROOT / "templates" / doc.template).is_file()


@pytest.mark.parametrize("doc", GENERIC, ids=lambda d: d.id)
def test_generic_fields_are_curated_camel_case_keys(doc):
    keys = [f.key for f in doc.fields]
    assert 4 <= len(keys) <= 12
    assert len(set(keys)) == len(keys)
    assert all(re.fullmatch(r"[a-z][a-zA-Z]*", k) and not k.startswith("party") for k in keys)


@pytest.mark.parametrize("document", [None, *DOCUMENTS])
def test_turn_schemas_are_groq_strict(document):
    assert strict_violations(turn_model(document).model_json_schema()) == []


@pytest.mark.parametrize("doc", GENERIC, ids=lambda d: d.id)
def test_generic_defaults_are_blank(doc):
    fields = default_fields(doc.id).model_dump(by_alias=True)
    assert list(fields) == ["party1", "party2", *(f.key for f in doc.fields)]
    assert all(fields[f.key] == "" for f in doc.fields)
    assert fields["party1"] == {"name": "", "title": "", "company": "", "noticeAddress": ""}


def test_generic_schema_describes_parties_with_the_document_labels():
    schema = fields_model("partnership").model_json_schema()
    assert schema["properties"]["party1"]["description"] == "The Company"
    assert schema["properties"]["party2"]["description"] == "The Partner"
