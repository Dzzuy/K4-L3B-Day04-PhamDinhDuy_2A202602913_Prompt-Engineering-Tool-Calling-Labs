"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
} from "@/components/icons";
import { getDatasetById } from "@/lib/data-store";
import type { DatasetItem } from "@/lib/types";
import { RiskBadge, StatusBadge } from "@/components/Badges";

export default function DatasetDetailPage() {
  const params = useParams();
  const id = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;
  const router = useRouter();

  const [dataset, setDataset] = useState<DatasetItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const item = getDatasetById(id);
      if (item) setDataset(item);
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-neutral-500">
        Loading dataset...
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-neutral-500">Dataset with ID {id} not found.</p>
        <Link
          href="/datasets"
          className="inline-block text-xs font-medium text-neutral-900 underline"
        >
          Return to Datasets
        </Link>
      </div>
    );
  }

  const findings = dataset.piiFindings || [];
  const columns = dataset.columns || [];
  const rawRows = dataset.rawRows || [];

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div className="space-y-1">
          <Link
            href="/datasets"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Datasets</span>
          </Link>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-neutral-700" />
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              {dataset.filename}
            </h1>
            <StatusBadge status={dataset.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dataset.status === "Protected" && (
            <Link
              href={`/datasets/${dataset.id}/result`}
              className="px-3.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
            >
              View Result
            </Link>
          )}
          <Link
            href={`/datasets/${dataset.id}/policy`}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors"
          >
            <span>Configure Policy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50/50">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Dataset Information
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-neutral-200 text-sm">
          <div className="p-4">
            <p className="text-xs text-neutral-500">File Name</p>
            <p className="font-mono text-xs font-medium text-neutral-900 mt-1 truncate">
              {dataset.filename}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-neutral-500">Number of Records</p>
            <p className="font-mono text-xs font-medium text-neutral-900 mt-1">
              {(dataset.records || 0).toLocaleString()}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-neutral-500">Number of Columns</p>
            <p className="font-mono text-xs font-medium text-neutral-900 mt-1">
              {dataset.colCount || columns.length}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-neutral-500">Created Time</p>
            <p className="font-mono text-xs font-medium text-neutral-900 mt-1">
              {dataset.createdAt}
            </p>
          </div>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            PII Findings ({findings.length})
          </h2>
          <span className="text-xs text-neutral-500">
            Assessed Risk: <RiskBadge risk={dataset.risk} />
          </span>
        </div>

        {findings.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">
            No PII findings detected in this dataset.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                  <th className="py-2.5 px-4">Column</th>
                  <th className="py-2.5 px-4">PII Type</th>
                  <th className="py-2.5 px-4">Confidence</th>
                  <th className="py-2.5 px-4">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {findings.map((f) => (
                  <tr key={f.column} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-neutral-900 text-xs">
                      {f.column}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-neutral-700">
                      {f.piiType}
                    </td>
                    <td className="py-3 px-4 text-xs text-neutral-600">
                      {f.confidence}
                    </td>
                    <td className="py-3 px-4">
                      <RiskBadge risk={f.risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/datasets"
          className="px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
        >
          Back to List
        </Link>
        <Link
          href={`/datasets/${dataset.id}/policy`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors"
        >
          <span>Protection Policy</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
