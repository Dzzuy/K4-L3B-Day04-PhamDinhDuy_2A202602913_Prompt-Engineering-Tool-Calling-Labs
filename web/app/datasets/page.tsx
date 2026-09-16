"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, FileSpreadsheet } from "@/components/icons";
import { getStoredDatasets } from "@/lib/data-store";
import type { DatasetItem } from "@/lib/types";
import { RiskBadge, StatusBadge } from "@/components/Badges";

export default function DatasetsPage() {
  const router = useRouter();
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);

  useEffect(() => {
    setDatasets(getStoredDatasets());
  }, []);

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Datasets
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            All registered data sources, personal data evaluations, and protection status.
          </p>
        </div>
        <Link
          href="/analyze"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Dataset</span>
        </Link>
      </div>

      {/* Datasets Table */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        {datasets.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">
            No datasets found. Upload a CSV file to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                  <th className="py-3 px-4">Dataset</th>
                  <th className="py-3 px-4">Records</th>
                  <th className="py-3 px-4">PII</th>
                  <th className="py-3 px-4">Risk</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {datasets.map((ds) => (
                  <tr
                    key={ds.id}
                    onClick={() => router.push(`/datasets/${ds.id}`)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-medium text-neutral-900">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                        <span className="font-mono text-xs">{ds.filename}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-neutral-700">
                      {ds.records.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-neutral-700">
                      {ds.piiCount}
                    </td>
                    <td className="py-3.5 px-4">
                      <RiskBadge risk={ds.risk} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={ds.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <ChevronRight className="w-4 h-4 text-neutral-400 inline-block group-hover:text-neutral-900 transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
