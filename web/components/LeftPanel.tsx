"use client";

import { useRef, useState } from "react";
import type { DatasetInfo } from "@/lib/types";

type Props = {
  dataset: DatasetInfo | null;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
};

function MiniTable({ rows, columns }: { rows: Record<string, string>[]; columns: string[] }) {
  if (!rows.length) {
    return <p className="text-sm text-neutral-500">No rows to preview.</p>;
  }
  return (
    <div className="overflow-auto rounded-lg border border-line">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-[#161616]">
          <tr>
            {columns.map((col) => (
              <th key={col} className="border-b border-line px-2 py-2 font-medium text-neutral-300">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="odd:bg-transparent even:bg-[#141414]">
              {columns.map((col) => (
                <td key={col} className="max-w-[140px] truncate border-b border-line px-2 py-1.5 text-neutral-400">
                  {row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeftPanel({ dataset, busy, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    await onUpload(file);
  }

  return (
    <section className="flex h-full min-h-0 flex-col border-r border-line bg-panel">
      <header className="border-b border-line px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Panel 01</p>
        <h2 className="mt-1 text-sm font-medium text-white">Data Management</h2>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            void handleFile(event.dataTransfer.files[0]);
          }}
          className={`block cursor-pointer rounded-xl border border-dashed p-5 text-center transition ${
            dragOver ? "border-white bg-card" : "border-line bg-[#101010]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <p className="text-sm text-white">Drop a CSV file</p>
          <p className="mt-1 text-xs text-neutral-500">or click to browse. Sample: starter_v0/privacyguard/sample_contacts.csv</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-md border border-line bg-card px-3 py-1.5 text-xs text-white hover:border-neutral-400 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Select CSV"}
          </button>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-card px-3 py-3">
            <p className="text-[11px] text-neutral-500">Rows</p>
            <p className="mt-1 text-lg text-white">{dataset?.row_count ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-line bg-card px-3 py-3">
            <p className="text-[11px] text-neutral-500">Columns</p>
            <p className="mt-1 text-lg text-white">{dataset?.col_count ?? "—"}</p>
          </div>
        </div>
        {dataset ? (
          <p className="truncate text-xs text-neutral-500">
            {dataset.filename} · {dataset.dataset_id}
            {dataset.masked ? " · masked" : ""}
          </p>
        ) : (
          <p className="text-xs text-neutral-500">No dataset loaded.</p>
        )}

        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-neutral-500">Raw preview</p>
          {dataset ? (
            <MiniTable rows={dataset.preview} columns={dataset.columns} />
          ) : (
            <div className="rounded-lg border border-line px-3 py-8 text-center text-xs text-neutral-500">
              Upload a CSV to inspect the first 5 rows.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
