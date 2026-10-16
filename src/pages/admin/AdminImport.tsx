import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { Button, Card, ErrorNote, Field, PageHeader, Select, Spinner } from "../../components/ui";

type TargetKey =
  | "name" | "country" | "city" | "state" | "cricos_code"
  | "qs_rank" | "the_rank" | "cs_subject_rank"
  | "tuition_aud" | "living_cost_aud"
  | "ielts_min" | "toefl_min" | "pte_min"
  | "min_academic_requirement" | "intakes" | "cs_program_highlights"
  | "post_study_work_years" | "data_year" | "confidence" | "source_url";

interface TargetField {
  key: TargetKey;
  label: string;
  required?: boolean;
  numeric?: boolean;
}

const TARGET_FIELDS: TargetField[] = [
  { key: "name", label: "Name", required: true },
  { key: "country", label: "Country", required: true },
  { key: "city", label: "City", required: true },
  { key: "state", label: "State" },
  { key: "cricos_code", label: "CRICOS code" },
  { key: "qs_rank", label: "QS rank", numeric: true },
  { key: "the_rank", label: "THE rank", numeric: true },
  { key: "cs_subject_rank", label: "CS subject rank", numeric: true },
  { key: "tuition_aud", label: "Tuition (AUD)", required: true, numeric: true },
  { key: "living_cost_aud", label: "Living cost (AUD)", required: true, numeric: true },
  { key: "ielts_min", label: "IELTS min", numeric: true },
  { key: "toefl_min", label: "TOEFL min", numeric: true },
  { key: "pte_min", label: "PTE min", numeric: true },
  { key: "min_academic_requirement", label: "Min academic requirement" },
  { key: "intakes", label: "Intakes (comma-sep)" },
  { key: "cs_program_highlights", label: "CS highlights" },
  { key: "post_study_work_years", label: "PSW years", numeric: true },
  { key: "data_year", label: "Data year", numeric: true },
  { key: "confidence", label: "Confidence" },
  { key: "source_url", label: "Source URL" },
];

function normalise(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface ImportLog {
  rows_total: number;
  rows_added: number;
  rows_updated: number;
  rows_rejected: number;
  errors: { idx: number; name: string | null; errors: string[] }[];
}

export default function AdminImport() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<TargetKey, string>>>({});
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [log, setLog] = useState<ImportLog | null>(null);

  function onFile(file: File) {
    setErr(null);
    setLog(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (!json.length) return setErr("The first sheet has no data rows.");
        const hs = Object.keys(json[0]);
        setHeaders(hs);
        setRawRows(json);
        // Auto-map by normalised header name.
        const auto: Partial<Record<TargetKey, string>> = {};
        for (const f of TARGET_FIELDS) {
          const match = hs.find((h) => normalise(h) === normalise(f.key) || normalise(h) === normalise(f.label));
          if (match) auto[f.key] = match;
        }
        setMapping(auto);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not read the file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function buildRows() {
    return rawRows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const f of TARGET_FIELDS) {
        const col = mapping[f.key];
        out[f.key] = col ? r[col] : null;
      }
      return out;
    });
  }

  function clientValidate(rows: Record<string, unknown>[]) {
    return rows.map((r, idx) => {
      const errors: string[] = [];
      for (const f of TARGET_FIELDS) {
        if (!f.required) continue;
        const v = r[f.key];
        if (v === null || v === undefined || String(v).trim() === "") errors.push(`${f.key}: required`);
      }
      for (const f of TARGET_FIELDS) {
        if (!f.numeric) continue;
        const v = r[f.key];
        if (v === null || v === undefined || v === "") continue;
        if (Number.isNaN(Number(String(v).replace(/[,\s]/g, "")))) errors.push(`${f.key}: not a number`);
      }
      return { idx, name: (r.name as string) ?? null, errors };
    }).filter((r) => r.errors.length);
  }

  async function runImport() {
    setBusy(true);
    setErr(null);
    try {
      const rows = buildRows();
      const { data, error } = await supabase.functions.invoke("admin-import", {
        method: "POST",
        body: { file_name: fileName, rows },
      });
      if (error) {
        const body = error.context ? await error.context.json().catch(() => null) : null;
        throw new Error(body?.error ?? "Import failed");
      }
      setLog(data as ImportLog);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const rows = rawRows.length ? buildRows() : [];
  const clientErrors = rows.length ? clientValidate(rows) : [];
  const preview = rows.slice(0, 8);

  return (
    <div>
      <PageHeader title="Excel import" subtitle="Upload an .xlsx of Australian universities. Columns are mapped, validated and upserted by (name + country)." />

      <Card className="mb-6">
        <Field label="Excel file" hint=".xlsx or .xls — first sheet is used">
          <input
            type="file"
            accept=".xlsx,.xls"
            className="block text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-800"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </Field>
      </Card>

      {headers.length ? (
        <>
          <Card className="mb-6">
            <h2 className="font-bold text-slate-900">Column mapping</h2>
            <p className="mt-1 text-sm text-slate-500">
              Auto-mapped by header name — adjust anything that looks wrong. Required fields must be mapped.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TARGET_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} hint={f.required ? "required" : undefined}>
                  <Select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}
                  >
                    <option value="">— skip —</option>
                    {headers.map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          </Card>

          <Card className="mb-6 overflow-x-auto p-0">
            <div className="px-4 pt-4">
              <h2 className="font-bold text-slate-900">
                Preview <span className="text-sm font-normal text-slate-500">({rawRows.length} rows, showing {preview.length})</span>
              </h2>
              {clientErrors.length ? (
                <p className="mt-1 text-sm font-semibold text-rose-600">{clientErrors.length} row(s) will be rejected — fix the source file or review the server log after import.</p>
              ) : (
                <p className="mt-1 text-sm text-emerald-700">All rows pass client-side validation.</p>
              )}
            </div>
            <table className="mt-3 w-full text-left text-xs">
              <thead className="border-y border-slate-200 bg-slate-50 uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">Tuition</th>
                  <th className="px-4 py-2">Living</th>
                  <th className="px-4 py-2">IELTS</th>
                  <th className="px-4 py-2">Issues</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => {
                  const errs = clientErrors.find((e) => e.idx === i);
                  return (
                    <tr key={i} className={errs ? "bg-rose-50" : ""}>
                      <td className="px-4 py-1.5">{i + 1}</td>
                      <td className="px-4 py-1.5 font-semibold">{String(r.name ?? "")}</td>
                      <td className="px-4 py-1.5">{String(r.city ?? "")}</td>
                      <td className="px-4 py-1.5">{String(r.tuition_aud ?? "")}</td>
                      <td className="px-4 py-1.5">{String(r.living_cost_aud ?? "")}</td>
                      <td className="px-4 py-1.5">{String(r.ielts_min ?? "")}</td>
                      <td className="px-4 py-1.5 text-rose-700">{errs?.errors.join("; ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <ErrorNote>{err}</ErrorNote>
          <Button onClick={runImport} disabled={busy || rawRows.length === 0}>
            {busy ? <Spinner className="size-4" /> : null}
            Import {rawRows.length} rows
          </Button>
        </>
      ) : null}

      {log ? (
        <Card className="mt-6 border-emerald-200 bg-emerald-50/60">
          <h2 className="font-bold text-emerald-900">Import complete</h2>
          <ul className="mt-2 space-y-1 text-sm text-emerald-900">
            <li>Total rows: {log.rows_total}</li>
            <li>Added: {log.rows_added}</li>
            <li>Updated: {log.rows_updated}</li>
            <li>Rejected: {log.rows_rejected}</li>
          </ul>
          {log.errors?.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">Rejected row details</summary>
              <ul className="mt-2 space-y-1 text-xs text-rose-700">
                {log.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.idx + 1} ({e.name ?? "unnamed"}): {e.errors.join("; ")}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
