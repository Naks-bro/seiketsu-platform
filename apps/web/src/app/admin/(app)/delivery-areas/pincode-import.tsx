"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { extractPincodes } from "@seiketsu/core/delivery-area";
import { savePincodesAction } from "../../delivery-area-actions";

type Found = { valid: string[]; invalid: string[]; source: string };

/** Type, paste or upload pincodes; see what was found; then add them (or replace the list). */
export function PincodeImport({ current }: { current: string[] }) {
  const [state, action, pending] = useActionState(savePincodesAction, undefined);
  const [text, setText] = useState("");
  const [file, setFile] = useState<Found | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const input = useRef<HTMLInputElement>(null);

  const found: Found = useMemo(() => file ?? { ...extractPincodes(text.split(/\n/)), source: "typed" }, [text, file]);
  const have = new Set(current);
  const fresh = found.valid.filter((p) => !have.has(p));

  // Clear the box once a save has gone through.
  useEffect(() => {
    if (!state?.ok) return;
    const t = setTimeout(() => {
      setText("");
      setFile(null);
      if (input.current) input.current.value = "";
    });
    return () => clearTimeout(t);
  }, [state]);

  async function readFile(f: File) {
    setFileError(null);
    try {
      let cells: unknown[];
      if (/\.xlsx$/i.test(f.name)) {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        cells = (await readXlsxFile(f)).flatMap((sheet) => sheet.data.flat());
      } else if (/\.(csv|txt)$/i.test(f.name)) {
        cells = (await f.text()).split(/\r?\n/);
      } else {
        setFile(null);
        setFileError("Choose an Excel file (.xlsx) or a CSV. For an old .xls file, open it in Excel and save as .xlsx first.");
        return;
      }
      setFile({ ...extractPincodes(cells), source: f.name });
    } catch {
      setFile(null);
      setFileError("We couldn't read that file. Check it opens in Excel, then try again.");
    }
  }

  const willSave = mode === "replace" ? found.valid.length : fresh.length;
  return (
    <section aria-labelledby="add-h" className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 id="add-h" className="font-display text-2xl">Add pincodes</h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Type or paste</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFile(null);
              if (input.current) input.current.value = "";
            }}
            rows={5}
            placeholder={"400061, 400053\nor one per line, or paste a column from Excel"}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 font-mono text-sm outline-none focus:border-berry"
          />
        </label>
        <div className="text-sm">
          <span className="font-medium">Or upload a file</span>
          <label className="relative mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-7 text-center hover:border-berry/50 hover:bg-paper">
            <span className="font-semibold text-berry">Choose Excel or CSV file</span>
            <span className="text-xs text-muted">.xlsx or .csv. Pincodes are picked up from any column, on every sheet.</span>
            <input ref={input} type="file" accept=".xlsx,.csv,.txt" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
          {fileError && <p role="alert" className="mt-2 text-nonveg">{fileError}</p>}
        </div>
      </div>

      {(found.valid.length > 0 || found.invalid.length > 0) && (
        <div className="mt-5 rounded-xl bg-paper p-4 text-sm" aria-live="polite">
          <p>
            {found.source !== "typed" && <span className="font-medium">{found.source}: </span>}
            Found <strong>{found.valid.length}</strong> pincode{found.valid.length === 1 ? "" : "s"}
            {found.valid.length > 0 && <> · <strong>{fresh.length}</strong> new · {found.valid.length - fresh.length} already on your list</>}.
          </p>
          {found.invalid.length > 0 && (
            <p className="mt-1 text-nonveg">
              Couldn’t use {found.invalid.length}: {found.invalid.slice(0, 12).join(", ")}
              {found.invalid.length > 12 ? "…" : ""}. A pincode is 6 digits and doesn’t start with 0.
            </p>
          )}
          {fresh.length > 0 && fresh.length <= 40 && <p className="mt-2 font-mono text-xs text-muted">{fresh.join("  ")}</p>}
        </div>
      )}

      <form action={action} className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <input type="hidden" name="pins" value={found.valid.join(",")} />
        <input type="hidden" name="mode" value={mode} />
        <fieldset className="flex flex-wrap gap-4 text-sm">
          <legend className="sr-only">How to save</legend>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "add"} onChange={() => setMode("add")} /> Add to my list
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace my list with these
          </label>
        </fieldset>
        <button
          type="submit"
          disabled={pending || willSave === 0}
          onClick={(e) => {
            if (mode === "replace" && current.length && !confirm(`Replace your ${current.length} pincodes with these ${found.valid.length}?`)) e.preventDefault();
          }}
          className="rounded-full bg-berry px-5 py-2.5 text-sm font-semibold text-cream hover:bg-berry-deep disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "replace" ? `Replace with ${found.valid.length}` : `Add ${fresh.length} pincode${fresh.length === 1 ? "" : "s"}`}
        </button>
        {state?.ok && <p role="status" className="text-sm text-veg">{state.ok}</p>}
        {state?.error && <p role="alert" className="text-sm text-nonveg">{state.error}</p>}
      </form>
    </section>
  );
}
