"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, CheckCircle2 } from "@/components/icons";

export default function PoliciesPage() {
  const policies = [
    {
      id: "pol-1",
      filename: "sample_pii.csv",
      source: "data/sample_pii.csv",
      created: "16 Sep 2026",
      status: "Applied",
      rules: [
        { field: "name", action: "PARTIAL_MASK", type: "FULL_NAME" },
        { field: "phone", action: "PARTIAL_MASK", type: "PHONE" },
        { field: "email", action: "PARTIAL_MASK", type: "EMAIL" },
        { field: "address", action: "PARTIAL_MASK", type: "ADDRESS" },
        { field: "job", action: "KEEP", type: "OCCUPATION" },
      ],
    },
    {
      id: "pol-2",
      filename: "customers.csv",
      source: "Mẫu doanh nghiệp",
      created: "16 Sep 2026",
      status: "Applied",
      rules: [
        { field: "cccd", action: "FULL_MASK", type: "NATIONAL_ID" },
        { field: "email", action: "PARTIAL_MASK", type: "EMAIL" },
        { field: "phone", action: "PARTIAL_MASK", type: "PHONE" },
        { field: "dob", action: "GENERALIZE", type: "DATE" },
        { field: "address", action: "PARTIAL_MASK", type: "ADDRESS" },
      ],
    },
    {
      id: "pol-3",
      filename: "employee.csv",
      source: "Mẫu doanh nghiệp",
      created: "15 Sep 2026",
      status: "Draft",
      rules: [
        { field: "ssn", action: "FULL_MASK", type: "NATIONAL_ID" },
        { field: "bank_account", action: "FULL_MASK", type: "FINANCIAL" },
        { field: "salary", action: "FULL_MASK", type: "FINANCIAL" },
        { field: "work_email", action: "PARTIAL_MASK", type: "EMAIL" },
      ],
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
          <span className="text-xs text-zinc-400 font-mono">PrivacyGuard / Policies</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Masking Policies</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Created masking policies, redaction matrices, and field-level transformation rules.
          </p>
        </div>

        {/* Policies List */}
        <div className="space-y-4">
          {policies.map((p) => (
            <div
              key={p.id}
              className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-3 shadow-xs hover:border-zinc-300 transition-all"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-zinc-900">{p.filename}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full font-mono">
                      {p.source}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">Tạo ngày: {p.created}</p>
                </div>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                    p.status === "Applied"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                  }`}
                >
                  {p.status}
                </span>
              </div>

              {/* Rules Table */}
              <div className="space-y-1.5 font-mono text-xs">
                {p.rules.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-zinc-50 rounded-lg flex items-center justify-between border border-zinc-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900">{r.field}</span>
                      <span className="text-[10px] text-zinc-400">({r.type})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 text-[11px]">→</span>
                      <span className="font-bold text-zinc-900 bg-white border border-zinc-200 px-2 py-0.5 rounded">
                        {r.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
