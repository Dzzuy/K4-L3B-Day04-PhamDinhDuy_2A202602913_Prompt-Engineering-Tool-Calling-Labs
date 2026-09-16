"use client";

import { useEffect, useState, useRef, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
} from "@/components/icons";

type FileRecord = {
  id: string;
  filename: string;
  rows: number;
  cols: number;
  time: string;
  status: string;
  risk: string;
};

export default function FilesPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileRecord[]>([
    {
      id: "ds_sample_pii",
      filename: "sample_pii.csv",
      rows: 300,
      cols: 16,
      time: "Thư mục data/",
      status: "Sẵn sàng",
      risk: "HIGH",
    },
    {
      id: "ds_pii_dataset",
      filename: "pii_dataset.csv",
      rows: 13302,
      cols: 16,
      time: "Thư mục data/",
      status: "Sẵn sàng",
      risk: "HIGH",
    },
    {
      id: "ds_customer",
      filename: "customer.csv",
      rows: 10000,
      cols: 7,
      time: "Mẫu doanh nghiệp",
      status: "Protected",
      risk: "CRITICAL",
    },
    {
      id: "ds_users",
      filename: "users.csv",
      rows: 5200,
      cols: 5,
      time: "Mẫu doanh nghiệp",
      status: "Analyzed",
      risk: "MEDIUM",
    },
    {
      id: "ds_employee",
      filename: "employee.csv",
      rows: 2100,
      cols: 7,
      time: "Mẫu doanh nghiệp",
      status: "Pending",
      risk: "HIGH",
    },
  ]);

  useEffect(() => {
    fetch("/api/files")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setFiles((prev) => {
            const existingIds = new Set(prev.map((f) => f.id));
            const existingNames = new Set(
              prev.map((f) => f.filename.toLowerCase().replace(/\.csv$/, "").replace(/s$/, ""))
            );

            const newFiles = data
              .filter((d: any) => {
                if (existingIds.has(d.id)) return false;
                const normName = (d.filename || "").toLowerCase().replace(/\.csv$/, "").replace(/s$/, "");
                if (existingNames.has(normName)) return false;
                return true;
              })
              .map((d: any) => ({
                id: d.id,
                filename: d.filename,
                rows: d.row_count,
                cols: d.column_count,
                time: d.created_at || "Vừa xong",
                status: d.status || "Ready",
                risk: d.risk || "MEDIUM",
              }));

            return [...prev, ...newFiles];
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const d = await res.json();
        setFiles((prev) => {
          const filtered = prev.filter((f) => f.id !== d.file_id && f.filename !== d.filename);
          return [
            {
              id: d.file_id,
              filename: d.filename,
              rows: d.row_count,
              cols: d.column_count,
              time: "Vừa tải lên",
              status: "Uploaded",
              risk: "PENDING",
            },
            ...filtered,
          ];
        });
        alert(`Đã tải lên tệp ${file.name} thành công!`);
      }
    } catch {
      alert("Lỗi khi tải file.");
    }
  };

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
          <span className="text-xs text-zinc-400 font-mono">PrivacyGuard / Files</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Files</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage uploaded and processed CSV data files.
          </p>
        </div>

        {/* Upload Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 hover:border-zinc-500 bg-white hover:bg-zinc-50/60 rounded-2xl p-10 text-center cursor-pointer transition-all shadow-xs"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleUpload}
          />
          <div className="flex flex-col items-center justify-center">
            <UploadCloud className="w-10 h-10 text-zinc-400 mb-3" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold text-zinc-900">Upload CSV</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Drag & drop your file here, or click to browse
            </p>
            <button
              type="button"
              className="mt-4 px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors"
            >
              Choose File
            </button>
          </div>
        </div>

        {/* Recent Files List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-900">Recent Files</h2>
          <div className="space-y-2.5">
            {files.map((f, idx) => (
              <div
                key={`${f.id}-${idx}`}
                className="p-4 bg-white border border-zinc-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-zinc-300 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-zinc-900">{f.filename}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-full font-medium">
                        {f.time}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                      {f.rows.toLocaleString()} rows · {f.cols} columns
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    Chat với file này
                  </button>
                  <a
                    href={`/api/download/csv/${f.id}`}
                    download
                    className="px-3.5 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-medium rounded-xl transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
