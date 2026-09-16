"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Download,
  CheckCircle2,
  X,
} from "@/components/icons";

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  const reports = [
    {
      id: "rep-1",
      filename: "sample_pii.csv",
      title: "PII Detection & Compliance Audit",
      piiFound: 5,
      protected: 5,
      risk: "HIGH",
      status: "PASSED",
      date: "2026-09-16 12:00",
      standard: "Nghị định 13/2023/NĐ-CP & ISO 27701",
      summary: "Đã phân tích 300 bản ghi từ thư mục data/. Phát hiện 5 loại PII (Họ tên, Email, SĐT, Địa chỉ, Nghề nghiệp). Xác thực 0-leakage: PASSED.",
    },
    {
      id: "rep-2",
      filename: "customers.csv",
      title: "PII Masking & Protection Report",
      piiFound: 6,
      protected: 6,
      risk: "CRITICAL",
      status: "PASSED",
      date: "2026-09-15 14:22",
      standard: "Nghị định 13/2023/NĐ-CP",
      summary: "Đã áp dụng Full Mask cho số CCCD và Partial Mask cho Email/Phone trên 10,000 khách hàng. Tỷ lệ bảo vệ 100%.",
    },
    {
      id: "rep-3",
      filename: "users.csv",
      title: "Credential Vector Privacy Audit",
      piiFound: 4,
      protected: 4,
      risk: "MEDIUM",
      status: "PASSED",
      date: "2026-09-15 15:15",
      standard: "GDPR & ISO 27701",
      summary: "Che mờ các thông tin liên lạc và địa chỉ IP trên 5,200 người dùng hệ thống. Kiểm định toàn vẹn PASSED.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-6">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium bg-white px-3 py-1.5 rounded-lg border border-zinc-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Chat</span>
          </Link>
          <span className="text-xs text-zinc-400 font-mono">PrivacyGuard / Reports</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Reports</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Generated privacy compliance audit reports and verification logs.
          </p>
        </div>

        {/* Reports Cards List */}
        <div className="space-y-3">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="p-5 bg-white border border-zinc-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:border-zinc-300 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-zinc-900">{rep.filename}</span>
                  <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
                    {rep.status}
                  </span>
                </div>
                <div className="text-xs font-semibold text-zinc-700">{rep.title}</div>
                <p className="text-xs text-zinc-500 font-mono">
                  PII Found: <strong className="text-zinc-900">{rep.piiFound} types</strong> · Risk: <strong className="text-amber-800">{rep.risk}</strong> · {rep.date}
                </p>
                <div className="text-[11px] text-zinc-400 font-mono">
                  Tiêu chuẩn: {rep.standard}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReport(rep)}
                  className="px-3.5 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 text-xs font-semibold rounded-xl transition-colors"
                >
                  View Report
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([`PRIVACY REPORT: ${rep.filename}\nStatus: ${rep.status}\nStandard: ${rep.standard}\n${rep.summary}`], { type: "text/plain" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `audit_report_${rep.filename.replace(".csv", "")}.txt`;
                    a.click();
                  }}
                  className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">{selectedReport.title}</h3>
                <p className="text-xs text-zinc-500 font-mono">{selectedReport.filename} · {selectedReport.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="text-xs p-1 text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Xác thực kiểm toán:</span>
                <span className="font-bold text-emerald-700">{selectedReport.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Khung pháp lý:</span>
                <span className="font-semibold text-zinc-800">{selectedReport.standard}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-zinc-700">Tóm tắt kết quả:</span>
              <p className="text-xs text-zinc-600 leading-relaxed p-3 bg-white border border-zinc-200 rounded-xl">
                {selectedReport.summary}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-black"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
