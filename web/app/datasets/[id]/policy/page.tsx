"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "@/components/icons";
import {
  getDatasetById,
  executeProtection,
} from "@/lib/data-store";
import type { DatasetItem, RedactionAction } from "@/lib/types";

const ACTIONS: { value: RedactionAction; label: string; desc: string }[] = [
  { value: "PARTIAL_MASK", label: "PARTIAL_MASK", desc: "Redact characters leaving partial domain or last 4 digits" },
  { value: "FULL_MASK", label: "FULL_MASK", desc: "Completely redact with asterisks (************)" },
  { value: "KEEP", label: "KEEP", desc: "Retain original unmodified value" },
  { value: "HASH", label: "HASH", desc: "One-way cryptographic hash representation" },
  { value: "ANONYMIZE", label: "ANONYMIZE", desc: "Replace with synthetic identifier (e.g. ANON_USER_01)" },
  { value: "GENERALIZE", label: "GENERALIZE", desc: "Coarsen value (e.g. year-only for birthdates)" },
  { value: "SUPPRESS", label: "SUPPRESS", desc: "Remove value completely (empty string)" },
];

export default function ProtectionPolicyPage() {
  const params = useParams();
  const id = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;
  const router = useRouter();

  const [dataset, setDataset] = useState<DatasetItem | null>(null);
  const [policy, setPolicy] = useState<Record<string, RedactionAction>>({});
  const [applying, setApplying] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (id) {
      const item = getDatasetById(id);
      if (item) {
        setDataset(item);
        const initialPolicy: Record<string, RedactionAction> = { ...(item.policy || {}) };
        (item.piiFindings || []).forEach((f) => {
          if (!initialPolicy[f.column]) {
            initialPolicy[f.column] = f.recommendedAction || "PARTIAL_MASK";
          }
        });
        setPolicy(initialPolicy);
      }
    }
    setLoaded(true);
  }, [id]);

  if (!dataset) {
    if (!loaded) {
      return (
        <div className="py-12 text-center text-sm text-neutral-500">
          Loading policy configuration...
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <p className="text-sm text-neutral-600">
          Dataset with ID <span className="font-mono">{id}</span> not found or session expired.
        </p>
        <Link
          href="/analyze"
          className="inline-block px-4 py-2 bg-black text-white text-xs font-medium rounded hover:bg-neutral-800"
        >
          Return to Analyze
        </Link>
      </div>
    );
  }

  const handleActionChange = (column: string, action: RedactionAction) => {
    setPolicy((prev) => ({
      ...prev,
      [column]: action,
    }));
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      executeProtection(dataset, policy);
      router.push(`/datasets/${dataset.id}/result`);
    } catch {
      setApplying(false);
    }
  };

  const findings = dataset.piiFindings || [];
  const columnsToConfigure = findings.length > 0
    ? findings.map((f) => f.column)
    : (dataset.columns || []);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      <div className="border-b border-neutral-200 pb-4">
        <Link
          href={`/datasets/${dataset.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dataset</span>
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Protection Policy
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Review and customize AI-recommended redaction actions for detected personal data in{" "}
          <span className="font-mono text-neutral-800">{dataset.filename}</span>.
        </p>
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Column Protection Matrix
          </h2>
          <span className="text-xs text-neutral-500">
            {columnsToConfigure.length} sensitive fields
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                <th className="py-3 px-4">Column</th>
                <th className="py-3 px-4">Recommended Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {columnsToConfigure.map((col) => {
                const finding = findings.find((f) => f.column === col);
                const currentAction = policy[col] || finding?.recommendedAction || "PARTIAL_MASK";

                return (
                  <tr key={col} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-neutral-900">
                          {col}
                        </span>
                        {finding && (
                          <span className="text-[11px] font-mono text-neutral-400">
                            ({finding.piiType})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={currentAction}
                        onChange={(e) =>
                          handleActionChange(col, e.target.value as RedactionAction)
                        }
                        className="font-mono text-xs px-2.5 py-1.5 bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                      >
                        {ACTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={`/datasets/${dataset.id}`}
          className="px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={applying}
          onClick={handleApply}
          className="inline-flex items-center gap-2 px-5 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
        >
          {applying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Applying Protection...</span>
            </>
          ) : (
            <span>Apply Protection</span>
          )}
        </button>
      </div>
    </div>
  );
}
