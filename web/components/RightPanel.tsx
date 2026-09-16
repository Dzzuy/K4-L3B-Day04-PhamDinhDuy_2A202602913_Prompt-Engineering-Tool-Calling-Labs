"use client";

import type { AgentTraceEvent } from "@/lib/types";

const PIPELINE = ["scan_dataset", "detect_pii", "preview_masking"];

function statusClass(status: string) {
  if (status === "success") return "text-white";
  if (status === "warning") return "text-neutral-300";
  return "text-neutral-500";
}

function statusMark(status: string) {
  if (status === "success") return "●";
  if (status === "warning") return "▲";
  return "○";
}

export default function RightPanel({ events }: { events: AgentTraceEvent[] }) {
  const byName = new Map(events.map((event) => [event.step, event]));

  return (
    <section className="flex h-full min-h-0 flex-col border-l border-line bg-panel">
      <header className="border-b border-line px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Panel 03</p>
        <h2 className="mt-1 text-sm font-medium text-white">Agent Trace Log</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-4 font-mono text-[11px] text-neutral-500">scan_dataset → detect_pii → preview_masking</p>
        <ol className="space-y-3">
          {PIPELINE.map((step, index) => {
            const event = byName.get(step);
            const status = event?.status || "pending";
            return (
              <li key={step} className="rounded-lg border border-line bg-[#101010] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-white">
                    {String(index + 1).padStart(2, "0")} {step}
                  </span>
                  <span className={`font-mono text-[11px] uppercase ${statusClass(status)}`}>
                    {statusMark(status)} {status}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] leading-5 text-neutral-500">
                  {event?.detail || "waiting"}
                </p>
                {event?.args ? (
                  <pre className="mt-2 overflow-auto font-mono text-[10px] leading-4 text-neutral-600">
                    {JSON.stringify(event.args, null, 2)}
                  </pre>
                ) : null}
              </li>
            );
          })}
          {events
            .filter((event) => !PIPELINE.includes(event.step))
            .map((event, index) => (
              <li key={`${event.step}-${index}`} className="rounded-lg border border-line bg-[#101010] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-white">{event.step}</span>
                  <span className={`font-mono text-[11px] uppercase ${statusClass(event.status)}`}>
                    {statusMark(event.status)} {event.status}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-neutral-500">{event.detail || ""}</p>
              </li>
            ))}
        </ol>
      </div>
    </section>
  );
}
