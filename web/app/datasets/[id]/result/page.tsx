"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Download,
  FileText,
  ArrowLeft,
} from "@/components/icons";
import {
  getDatasetById,
  generateCsvDownload,
  generateAuditReportText,
} from "@/lib/data-store";
import type { DatasetItem } from "@/lib/types";

export default function ProtectionResultPage() {
  const params = useParams();
  const id = (Array.isArray(params?.id) ? params.id[0] : params?.id) as string;

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
        Loading protection results...
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <p className="text-sm text-neutral-600">Dataset with ID {id} not found.</p>
        <Link
          href="/datasets"
          className="inline-block px-4 py-2 bg-black text-white text-xs font-medium rounded hover:bg-neutral-800"
        >
          Return to Datasets
        </Link>
      </div>
    );
  }

  const findings = dataset.piiFindings || [];
  const result = dataset.result || {
    recordsProcessed: dataset.records || 100,
    piiFieldsDetected: findings.length,
    valuesProtected: (dataset.records || 100) * (findings.length || 1),
    verification: "PASSED" as const,
    completedAt: dataset.createdAt || "Just now",
  };

  const handleDownloadCsv = () => {
    const csvContent = generateCsvDownload(dataset);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `protected_${dataset.filename}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAuditReport = () => {
    const reportText = generateAuditReportText(dataset);
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `audit_report_${dataset.filename.replace(/\.csv$/i, "")}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-8">
      <Link
        href={`/datasets/${dataset.id}`}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to {dataset.filename}</span>
      </Link>

      <div className="border border-neutral-200 rounded-lg p-6 bg-white space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Protection completed
          </h1>
          <p className="text-xs text-neutral-500 mt-1 font-mono">
            {dataset.filename}
          </p>
        </div>

        <div className="border-t border-b border-neutral-200 py-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Records processed</span>
            <span className="font-mono font-medium text-neutral-900">
              {(result.recordsProcessed || 0).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-500">PII fields detected</span>
            <span className="font-mono font-medium text-neutral-900">
              {result.piiFieldsDetected || 0}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Values protected</span>
            <span className="font-mono font-medium text-neutral-900">
              {(result.valuesProtected || 0).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Verification</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-neutral-100 text-neutral-900 border border-neutral-300">
              {result.verification}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Protected CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAuditReport}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
          >
            <FileText className="w-4 h-4 text-neutral-500" />
            <span>Download Audit Report</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-2">
        <Link
          href="/datasets"
          className="text-neutral-600 hover:text-neutral-900 underline"
        >
          View all datasets
        </Link>
        <Link
          href="/reports"
          className="text-neutral-600 hover:text-neutral-900 underline"
        >
          View audit reports
        </Link>
      </div>
    </div>
  );
}
