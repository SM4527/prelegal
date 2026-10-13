"use client";

import { useId, type ReactNode } from "react";
import type { NdaFormData, Party, Term } from "@/lib/nda";

interface NdaFormProps {
  data: NdaFormData;
  onChange: (data: NdaFormData) => void;
}

const controlClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";
const hintClass = "text-xs text-zinc-600";
const labelClass = "text-sm font-medium text-zinc-800";

const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-zinc-200 pt-5">
      <legend className="pr-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">{title}</legend>
      {children}
    </fieldset>
  );
}

/** A labelled text input or textarea; the hint is exposed as the control's description. */
function TextField({ label, hint, value, onChange, type = "text", multiline = false }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  multiline?: boolean;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const props = {
    id,
    value,
    "aria-describedby": hintId,
    className: `w-full ${controlClass}`,
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>{label}</label>
      {hint && <p id={hintId} className={hintClass}>{hint}</p>}
      {multiline ? (
        <textarea rows={3} {...props} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} {...props} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/** A radio group choosing between a fixed number of years and an open-ended term. */
function TermChoice({ name, legend, hint, term, fixedLabel, openLabel, yearsLabel, onChange }: {
  name: string;
  legend: string;
  hint: string;
  term: Term;
  /** Text around the years dropdown, e.g. ["Expires after", "year(s)"]. */
  fixedLabel: [before: string, after: string];
  openLabel: string;
  yearsLabel: string;
  onChange: (term: Term) => void;
}) {
  const hintId = `${useId()}-hint`;
  const optionClass = "flex items-center gap-2 text-sm text-zinc-800";
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={hintId}>
      <legend className={labelClass}>{legend}</legend>
      <p id={hintId} className={`${hintClass} -mt-1`}>{hint}</p>
      <div className={optionClass}>
        <label className="flex items-center gap-2">
          <input type="radio" name={name} checked={term.fixed} onChange={() => onChange({ ...term, fixed: true })} />
          {fixedLabel[0]}
        </label>
        <select
          aria-label={yearsLabel}
          value={term.years}
          disabled={!term.fixed}
          onChange={(e) => onChange({ fixed: true, years: Number(e.target.value) })}
          className={`${controlClass} w-20 shrink-0 disabled:bg-zinc-100 disabled:text-zinc-500`}
        >
          {YEAR_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span aria-hidden="true">{fixedLabel[1]}</span>
      </div>
      <label className={optionClass}>
        <input type="radio" name={name} checked={!term.fixed} onChange={() => onChange({ ...term, fixed: false })} />
        {openLabel}
      </label>
    </fieldset>
  );
}

function PartyFields({ title, party, onChange }: {
  title: string;
  party: Party;
  onChange: (party: Party) => void;
}) {
  const field = (key: keyof Party) => ({
    value: party[key],
    onChange: (value: string) => onChange({ ...party, [key]: value }),
  });
  return (
    <Section title={title}>
      <TextField label="Company" {...field("company")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Signer name" {...field("name")} />
        <TextField label="Title" {...field("title")} />
      </div>
      <TextField label="Notice address" hint="Email or postal address for legal notices" {...field("noticeAddress")} />
    </Section>
  );
}

export function NdaForm({ data, onChange }: NdaFormProps) {
  const field = <K extends keyof NdaFormData>(key: K) => ({
    value: data[key],
    onChange: (value: NdaFormData[K]) => onChange({ ...data, [key]: value }),
  });

  return (
    <form className="flex flex-col gap-6" aria-label="Agreement details" onSubmit={(e) => e.preventDefault()}>
      <Section title="Agreement">
        <TextField label="Purpose" hint="How Confidential Information may be used" multiline {...field("purpose")} />
        <TextField label="Effective date" hint="Leave blank to use today's date" type="date" {...field("effectiveDate")} />
        <TermChoice
          name="mndaTerm"
          legend="MNDA term"
          hint="The length of this MNDA"
          term={data.mndaTerm}
          fixedLabel={["Expires after", "year(s)"]}
          openLabel="Continues until terminated"
          yearsLabel="MNDA term in years"
          onChange={field("mndaTerm").onChange}
        />
        <TermChoice
          name="confidentialityTerm"
          legend="Term of confidentiality"
          hint="How long Confidential Information is protected"
          term={data.confidentialityTerm}
          fixedLabel={["Protected for", "year(s) from the effective date"]}
          openLabel="In perpetuity"
          yearsLabel="Term of confidentiality in years"
          onChange={field("confidentialityTerm").onChange}
        />
      </Section>

      <Section title="Governing law & jurisdiction">
        <TextField label="Governing law" hint="State whose laws govern the MNDA, e.g. Delaware" {...field("governingLaw")} />
        <TextField
          label="Jurisdiction"
          hint="City or county and state, e.g. courts located in New Castle, DE"
          {...field("jurisdiction")}
        />
        <TextField label="Modifications" hint="Optional changes to the Standard Terms" multiline {...field("modifications")} />
      </Section>

      <PartyFields title="Party 1" party={data.party1} onChange={field("party1").onChange} />
      <PartyFields title="Party 2" party={data.party2} onChange={field("party2").onChange} />
    </form>
  );
}
