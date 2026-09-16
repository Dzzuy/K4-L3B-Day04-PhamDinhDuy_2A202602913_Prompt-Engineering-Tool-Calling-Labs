"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { ChatMessage, PreviewData } from "@/lib/types";

type Props = {
  messages: ChatMessage[];
  preview: PreviewData | null;
  view: "table" | "json";
  canConfirm: boolean;
  confirming: boolean;
  sending: boolean;
  onViewChange: (view: "table" | "json") => void;
  onSend: (message: string) => Promise<void>;
  onConfirm: () => Promise<void>;
};

export default function CenterPanel({
  messages,
  preview,
  view,
  canConfirm,
  confirming,
  sending,
  onViewChange,
  onSend,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, preview]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await onSend(text);
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-ink">
      <header className="border-b border-line px-5 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Panel 02</p>
        <h2 className="mt-1 text-sm font-medium text-white">AI Assistant & Masking Preview</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-line bg-panel px-4 py-6 text-sm text-neutral-400">
              Upload a CSV, then ask PrivacyGuard to scan for PII. Example:
              <span className="mt-2 block text-white">Scan this dataset and preview masking.</span>
            </div>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "bg-white text-black"
                    : "border border-line bg-panel text-neutral-100"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>

        {preview ? (
          <div className="mt-5 rounded-xl border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Masking preview</p>
                <p className="mt-1 text-xs text-neutral-400">
                  {preview.masked_columns?.length
                    ? `Columns: ${preview.masked_columns.join(", ")}`
                    : preview.warning || "No columns selected"}
                </p>
              </div>
              <div className="flex gap-1 rounded-md border border-line p-0.5">
                {(["table", "json"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onViewChange(mode)}
                    className={`rounded px-2 py-1 text-[11px] uppercase tracking-wide ${
                      view === mode ? "bg-white text-black" : "text-neutral-400"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-64 overflow-auto p-3">
              {view === "json" ? (
                <pre className="font-mono text-[11px] leading-5 text-neutral-300">
                  {JSON.stringify(preview.rows, null, 2)}
                </pre>
              ) : (
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead>
                    <tr>
                      {preview.columns.map((col) => (
                        <th
                          key={col}
                          className={`border-b border-line px-2 py-2 ${
                            preview.masked_columns?.includes(col) ? "text-white" : "text-neutral-500"
                          }`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, index) => (
                      <tr key={index}>
                        {preview.columns.map((col) => (
                          <td key={col} className="border-b border-line px-2 py-1.5 text-neutral-300">
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t border-line p-3">
              <button
                type="button"
                disabled={!canConfirm || confirming}
                onClick={() => void onConfirm()}
                className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                {confirming ? "Applying mask…" : "Confirm Masking"}
              </button>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-line bg-[#0c0c0c] p-4">
        <div className="flex items-end gap-2 rounded-xl border border-line bg-panel px-3 py-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            placeholder="Message PrivacyGuard AI…"
            className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-sm text-white outline-none placeholder:text-neutral-600"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-md bg-white px-3 py-2 text-xs font-medium text-black disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
