"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  ChevronRight,
  X,
  Download,
  ShieldCheck,
  AlertTriangle,
} from "@/components/icons";
import { getStoredReports, getDatasetById, generateAuditReportText } from "@/lib/data-store";
import type { AuditReportItem } from "@/lib/types";
import { StatusBadge } from "@/components/Badges";

export default function ReportsPage() {
  const [reports, setReports] = useState<AuditReportItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<AuditReportItem | null>(null);

  useEffect(() => {
    setReports(getStoredReports());
  }, []);

  const handleDownloadReport = (rep: AuditReportItem) => {
    const dataset = getDatasetById(rep.datasetId);
    let content = "";
    if (dataset) {
      content = generateAuditReportText(dataset);
    } else {
      content = `PII GUARD AUDIT REPORT\nDataset: ${rep.dataset}\nDate: ${rep.date}\nVerification: ${rep.verification}\nPII Found: ${rep.piiFound}\nProtected: ${rep.protected}\n\nSummary:\n${rep.summary}`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `audit_report_${rep.dataset.replace(/\.csv$/i, "")}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Reports
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Compliance verification logs and cryptographic audit trail.
        </p>
      </div>

      {/* Reports Table */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
        {reports.length === 0 ? (
          <div className="p-12 text-center text-sm text-neutral-500">
            No audit reports generated yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                  <th className="py-3 px-4">Dataset</th>
                  <th className="py-3 px-4">PII Found</th>
                  <th className="py-3 px-4">Protected</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {reports.map((rep) => (
                  <tr
                    key={rep.id}
                    onClick={() => setSelectedReport(rep)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-medium text-neutral-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                        <span className="font-mono text-xs">{rep.dataset}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-neutral-700">
                      {rep.piiFound}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-neutral-700">
                      {rep.protected}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={rep.verification} />
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

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">
                  Audit Report Details
                </h3>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                  {selectedReport.dataset} · {selectedReport.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1 text-neutral-400 hover:text-neutral-900 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verification status */}
            <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded">
              <span className="text-xs font-medium text-neutral-700">Verification Result</span>
              <StatusBadge status={selectedReport.verification} />
            </div>

            {/* Summary */}
            <div className="space-y-1 text-xs">
              <p className="font-medium text-neutral-700">Audit Summary</p>
              <p className="text-neutral-600 leading-relaxed bg-white border border-neutral-200 rounded p-3">
                {selectedReport.summary}
              </p>
            </div>

            {/* Breakdown */}
            {selectedReport.details && selectedReport.details.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <p className="font-medium text-neutral-700">Verification Checkpoints</p>
                <div className="border border-neutral-200 rounded divide-y divide-neutral-100 bg-neutral-50/50">
                  {selectedReport.details.map((detail, idx) => (
                    <div key={idx} className="p-2 font-mono text-[11px] text-neutral-700">
                      • {detail}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-3.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownloadReport(selectedReport)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Report</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
