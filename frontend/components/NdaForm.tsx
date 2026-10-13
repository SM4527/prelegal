"use client";

import type { ReactNode } from "react";
import type { NdaFormData, Party } from "@/lib/nda";

interface NdaFormProps {
  data: NdaFormData;
  onChange: (data: NdaFormData) => void;
}

const controlClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";
const inputClass = `w-full ${controlClass}`;

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-zinc-200 pt-5">
      <legend className="pr-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function YearsInput({ value, disabled, onChange, label }: {
  value: number;
  disabled: boolean;
  onChange: (years: number) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${controlClass} w-20 shrink-0 disabled:bg-zinc-100 disabled:text-zinc-400`}
    >
      {YEAR_OPTIONS.map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}

function PartyFields({ title, party, onChange }: {
  title: string;
  party: Party;
  onChange: (party: Party) => void;
}) {
  const set = (field: keyof Party) => (e: { target: { value: string } }) =>
    onChange({ ...party, [field]: e.target.value });
  return (
    <Section title={title}>
      <Field label="Company">
        <input className={inputClass} value={party.company} onChange={set("company")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Signer name">
          <input className={inputClass} value={party.name} onChange={set("name")} />
        </Field>
        <Field label="Title">
          <input className={inputClass} value={party.title} onChange={set("title")} />
        </Field>
      </div>
      <Field label="Notice address" hint="Email or postal address for legal notices">
        <input className={inputClass} value={party.noticeAddress} onChange={set("noticeAddress")} />
      </Field>
    </Section>
  );
}

export function NdaForm({ data, onChange }: NdaFormProps) {
  const update = (patch: Partial<NdaFormData>) => onChange({ ...data, ...patch });
  const mndaYears = data.mndaTerm.type === "expires" ? data.mndaTerm.years : 1;
  const confidentialityYears = data.confidentialityTerm.type === "years" ? data.confidentialityTerm.years : 1;

  return (
    <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
      <Section title="Agreement">
        <Field label="Purpose" hint="How Confidential Information may be used">
          <textarea
            rows={3}
            className={inputClass}
            value={data.purpose}
            onChange={(e) => update({ purpose: e.target.value })}
          />
        </Field>
        <Field label="Effective date">
          <input
            type="date"
            className={inputClass}
            value={data.effectiveDate}
            onChange={(e) => update({ effectiveDate: e.target.value })}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-800">MNDA term</span>
          <span className="text-xs text-zinc-500">The length of this MNDA</span>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="mndaTerm"
              checked={data.mndaTerm.type === "expires"}
              onChange={() => update({ mndaTerm: { type: "expires", years: mndaYears } })}
            />
            Expires after
            <YearsInput
              label="MNDA term in years"
              value={mndaYears}
              disabled={data.mndaTerm.type !== "expires"}
              onChange={(years) => update({ mndaTerm: { type: "expires", years } })}
            />
            year(s)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="mndaTerm"
              checked={data.mndaTerm.type === "continues"}
              onChange={() => update({ mndaTerm: { type: "continues" } })}
            />
            Continues until terminated
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-800">Term of confidentiality</span>
          <span className="text-xs text-zinc-500">How long Confidential Information is protected</span>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="confidentialityTerm"
              checked={data.confidentialityTerm.type === "years"}
              onChange={() => update({ confidentialityTerm: { type: "years", years: confidentialityYears } })}
            />
            <YearsInput
              label="Term of confidentiality in years"
              value={confidentialityYears}
              disabled={data.confidentialityTerm.type !== "years"}
              onChange={(years) => update({ confidentialityTerm: { type: "years", years } })}
            />
            year(s) from the effective date
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="radio"
              name="confidentialityTerm"
              checked={data.confidentialityTerm.type === "perpetual"}
              onChange={() => update({ confidentialityTerm: { type: "perpetual" } })}
            />
            In perpetuity
          </label>
        </div>
      </Section>

      <Section title="Governing law & jurisdiction">
        <Field label="Governing law" hint="State whose laws govern the MNDA, e.g. Delaware">
          <input
            className={inputClass}
            value={data.governingLaw}
            onChange={(e) => update({ governingLaw: e.target.value })}
          />
        </Field>
        <Field label="Jurisdiction" hint="City or county and state, e.g. courts located in New Castle, DE">
          <input
            className={inputClass}
            value={data.jurisdiction}
            onChange={(e) => update({ jurisdiction: e.target.value })}
          />
        </Field>
        <Field label="Modifications" hint="Optional changes to the Standard Terms">
          <textarea
            rows={3}
            className={inputClass}
            value={data.modifications}
            onChange={(e) => update({ modifications: e.target.value })}
          />
        </Field>
      </Section>

      <PartyFields title="Party 1" party={data.party1} onChange={(party1) => update({ party1 })} />
      <PartyFields title="Party 2" party={data.party2} onChange={(party2) => update({ party2 })} />
    </form>
  );
}
