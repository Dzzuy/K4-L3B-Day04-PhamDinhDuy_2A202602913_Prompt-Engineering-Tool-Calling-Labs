import React from "react";
import type { RiskLevel, DatasetStatus } from "@/lib/types";

export function RiskBadge({ risk }: { risk: RiskLevel | string }) {
  const normalized = (risk || "LOW").toUpperCase();

  if (normalized === "CRITICAL") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-black text-white">
        CRITICAL
      </span>
    );
  }
  if (normalized === "HIGH") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-neutral-200 text-neutral-900 border border-neutral-300">
        HIGH
      </span>
    );
  }
  if (normalized === "MEDIUM") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono text-neutral-800 bg-neutral-100 border border-neutral-200">
        MEDIUM
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono text-neutral-600 bg-white border border-neutral-200">
      LOW
    </span>
  );
}

export function StatusBadge({ status }: { status: DatasetStatus | "PASSED" | "FAILED" | string }) {
  if (status === "Protected" || status === "PASSED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-neutral-100 text-neutral-900 border border-neutral-300">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
        {status}
      </span>
    );
  }
  if (status === "Analyzed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-neutral-800 bg-neutral-50 border border-neutral-200">
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
        {status}
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-black text-white">
        FAILED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono text-neutral-500 bg-white border border-neutral-200">
      <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
      {status || "Pending"}
    </span>
  );
}
