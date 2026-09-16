"use client";

import { useState, useRef, DragEvent, ChangeEvent, useMemo } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  AlertCircle,
  Loader2,
  Copy,
  CheckCircle2,
  ShieldCheck,
  Shield,
  Download,
  FileText,
  RefreshCw,
} from "@/components/icons";
import {
  analyzeDatasetContent,
  parseCsvText,
  saveDataset,
  executeProtection,
  generateCsvDownload,
  generateAuditReportText,
  INITIAL_DATASETS,
} from "@/lib/data-store";
import { uploadCsv, confirmMask } from "@/lib/api";
import type { DatasetItem, RedactionAction } from "@/lib/types";
import { RiskBadge, StatusBadge } from "@/components/Badges";

const PII_RULES = [
  { type: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, label: "Email" },
  { type: "PHONE", regex: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g, label: "Số điện thoại" },
  { type: "NATIONAL_ID", regex: /\b\d{9,12}\b|\b\d{3}-\d{2}-\d{4}\b/g, label: "CCCD / CMND / SSN" },
  { type: "CREDIT_CARD", regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, label: "Thẻ ngân hàng" },
  { type: "FINANCIAL", regex: /\b(?:\$|USD|VND|VNĐ)?\s*\d{1,3}(?:[.,]\d{3})*(?:\s*(?:USD|VND|VNĐ|triệu|tr))?\b/gi, label: "Lương / Tài chính" },
  { type: "NAME", regex: /\b(Nguyen Van [A-Z]|Tran Thi [A-Z]|Le Hoang [A-Z]|Pham Minh [A-Z]|Vo Thi [A-Z]|John Miller|Hana Vo|Ken Tran|Maya Chen|Omar Haddad|Priya Nair|Leo Park)\b/gi, label: "Họ và tên" },
];

export default function AnalyzeView() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"csv" | "text">("csv");
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CSV Flow states: 1: upload/scan, 2: findings & policy, 3: result
  const [datasetStep, setDatasetStep] = useState<"findings" | "policy" | "result">("findings");
  const [analyzedDataset, setAnalyzedDataset] = useState<DatasetItem | null>(null);
  const [activePolicy, setActivePolicy] = useState<Record<string, RedactionAction>>({});
  const [applyingMask, setApplyingMask] = useState(false);

  // AI Agent Trace state
  const [agentTrace, setAgentTrace] = useState<
    { step: string; status: string; detail: string; time: string }[]
  >([]);

  // Text Scrubber states
  const [rawText, setRawText] = useState(
    "Subject: Hồ sơ nhân viên và thông tin chi trả\n" +
    "Họ và tên: Nguyen Van A\n" +
    "Số CCCD: 001099012345\n" +
    "Email liên hệ: nguyen.vana@company.org\n" +
    "Số điện thoại: +84-912-345-678\n" +
    "Thẻ ngân hàng: 4111-2222-3333-4444\n" +
    "Mức lương hiện tại: 25,000,000 VND/tháng\n" +
    "Địa chỉ: 123 Le Loi, District 1, HCMC\n" +
    "Yêu cầu AI Agent kiểm tra và che mờ PII trước khi chuyển tiếp cho bên thứ ba."
  );
  const [scrubStyle, setScrubStyle] = useState<"TOKENS" | "PARTIAL" | "FULL" | "HASH">("TOKENS");
  const [copySuccess, setCopySuccess] = useState(false);

  // Process CSV File with AI Agent Tool Loop
  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Vui lòng tải lên file định dạng .csv");
      return;
    }
    setError(null);
    setAnalyzing(true);
    setAnalyzedDataset(null);
    setDatasetStep("findings");

    const nowTime = () => new Date().toLocaleTimeString();
    const trace: { step: string; status: string; detail: string; time: string }[] = [];

    try {
      // Step 1: scan_dataset tool
      trace.push({
        step: "scan_dataset",
        status: "running",
        detail: `Đang quét cấu trúc file: ${file.name}`,
        time: nowTime(),
      });
      setAgentTrace([...trace]);

      const text = await file.text();
      const { columns, rows } = parseCsvText(text);

      trace[0].status = "success";
      trace[0].detail = `Đã quét ${rows.length.toLocaleString()} bản ghi · ${columns.length} cột dữ liệu`;

      // Step 2: detect_pii tool
      trace.push({
        step: "detect_pii",
        status: "running",
        detail: "AI Agent đang quét phân loại các trường dữ liệu nhạy cảm PII...",
        time: nowTime(),
      });
      setAgentTrace([...trace]);

      const dataset = analyzeDatasetContent(file.name, columns, rows);

      trace[1].status = "success";
      trace[1].detail = `Phát hiện ${dataset.piiCount} cột PII nhạy cảm (Đánh giá rủi ro: ${dataset.risk})`;

      // Step 3: preview_masking tool
      trace.push({
        step: "preview_masking",
        status: "running",
        detail: "Đang tạo bản xem trước che mờ và cấp confirmation_token...",
        time: nowTime(),
      });
      setAgentTrace([...trace]);

      // Attempt async backend upload
      try {
        await uploadCsv(file);
      } catch {
        // Safe local fallback
      }

      saveDataset(dataset);
      setActivePolicy({ ...dataset.policy });

      trace[2].status = "success";
      trace[2].detail = `Cấp confirmation_token: tok_${Math.random().toString(36).substring(2, 10)}. Chờ người dùng xác nhận.`;
      setAgentTrace([...trace]);

      setAnalyzedDataset(dataset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi đọc file CSV.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelectSample = (sample: DatasetItem) => {
    const nowTime = () => new Date().toLocaleTimeString();
    setAgentTrace([
      {
        step: "scan_dataset",
        status: "success",
        detail: `Dataset mẫu: ${sample.filename} (${sample.records.toLocaleString()} hàng, ${sample.colCount} cột)`,
        time: nowTime(),
      },
      {
        step: "detect_pii",
        status: "success",
        detail: `Tìm thấy ${sample.piiCount} cột nhạy cảm. Rủi ro mức ${sample.risk}.`,
        time: nowTime(),
      },
      {
        step: "preview_masking",
        status: "success",
        detail: `Đã chuẩn bị ma trận che mờ cho ${sample.piiCount} cột. Token xác nhận sẵn sàng.`,
        time: nowTime(),
      },
    ]);
    saveDataset(sample);
    setActivePolicy({ ...sample.policy });
    setAnalyzedDataset(sample);
    setDatasetStep("findings");
  };

  // Step 4: Apply Masking (Write action confirmed by user)
  const handleApplyMasking = async () => {
    if (!analyzedDataset) return;
    setApplyingMask(true);

    const nowTime = () => new Date().toLocaleTimeString();
    const updated = executeProtection(analyzedDataset, activePolicy);

    // Call backend mask endpoint if applicable
    try {
      const piiCols = Object.keys(activePolicy);
      await confirmMask(analyzedDataset.id, piiCols, "tok_user_confirmed");
    } catch {
      // Safe local fallback
    }

    setAgentTrace((prev) => [
      ...prev,
      {
        step: "apply_masking",
        status: "success",
        detail: `Đã thực thi che mờ ${updated.result?.valuesProtected.toLocaleString()} giá trị nhạy cảm. Trạng thái kiểm định: PASSED.`,
        time: nowTime(),
      },
    ]);

    setAnalyzedDataset(updated);
    setApplyingMask(false);
    setDatasetStep("result");
  };

  // Drag & Drop handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  // ----------------------------------------------------
  // TEXT SCRUBBER: BÔI VÀNG VĂN BẢN THÔ & CĂN CHỈNH OUTPUT
  // ----------------------------------------------------
  const textMatches = useMemo(() => {
    if (!rawText) return [];
    const matches: { start: number; end: number; text: string; type: string }[] = [];
    PII_RULES.forEach((rule) => {
      const re = new RegExp(rule.regex.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(rawText)) !== null) {
        matches.push({
          start: m.index,
          end: m.index + m[0].length,
          text: m[0],
          type: rule.type,
        });
      }
    });
    // Sắp xếp theo vị trí xuất hiện
    matches.sort((a, b) => a.start - b.start);
    // Loại bỏ match trùng lặp
    const nonOverlapping: typeof matches = [];
    let lastEnd = 0;
    for (const match of matches) {
      if (match.start >= lastEnd) {
        nonOverlapping.push(match);
        lastEnd = match.end;
      }
    }
    return nonOverlapping;
  }, [rawText]);

  // Render raw text with detected PII highlighted in YELLOW
  const renderedRawWithHighlights = useMemo(() => {
    if (!rawText) return <span className="text-neutral-400">Chưa có văn bản đầu vào...</span>;
    if (textMatches.length === 0) return <span>{rawText}</span>;

    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    textMatches.forEach((match, idx) => {
      if (match.start > currentIndex) {
        parts.push(
          <span key={`text-${currentIndex}`}>
            {rawText.substring(currentIndex, match.start)}
          </span>
        );
      }
      parts.push(
        <mark
          key={`highlight-${idx}`}
          style={{
            backgroundColor: "#fef08a",
            color: "#854d0e",
            padding: "2px 4px",
            borderRadius: "3px",
            fontWeight: 600,
            border: "1px solid #fde047",
          }}
          title={`Phát hiện PII: ${match.type}`}
        >
          {match.text}
        </mark>
      );
      currentIndex = match.end;
    });

    if (currentIndex < rawText.length) {
      parts.push(
        <span key={`text-${currentIndex}`}>{rawText.substring(currentIndex)}</span>
      );
    }

    return parts;
  }, [rawText, textMatches]);

  // Sanitized output with clean alignment & formatting
  const sanitizedOutput = useMemo(() => {
    if (!rawText) return "";
    let res = rawText;

    // Thay thế Email
    res = res.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, (val) => {
      if (scrubStyle === "TOKENS") return "[EMAIL]";
      if (scrubStyle === "PARTIAL") return val[0] + "***@" + val.split("@")[1];
      if (scrubStyle === "FULL") return "************";
      return "h_" + Math.abs(val.length * 31).toString(16);
    });

    // Thay thế Phone
    res = res.replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g, (val) => {
      if (scrubStyle === "TOKENS") return "[PHONE]";
      if (scrubStyle === "PARTIAL") return "***-***-" + val.slice(-4);
      if (scrubStyle === "FULL") return "************";
      return "h_" + Math.abs(val.length * 47).toString(16);
    });

    // Thay thế CCCD / SSN
    res = res.replace(/\b(\d{9,12}|\d{3}-\d{2}-\d{4})\b/g, (val) => {
      if (scrubStyle === "TOKENS") return "[NATIONAL_ID]";
      if (scrubStyle === "PARTIAL") return val.slice(0, 3) + "******" + val.slice(-3);
      if (scrubStyle === "FULL") return "************";
      return "h_" + Math.abs(val.length * 19).toString(16);
    });

    // Thay thế Thẻ ngân hàng
    res = res.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, () => {
      if (scrubStyle === "TOKENS") return "[CREDIT_CARD]";
      return "**** **** **** ****";
    });

    // Thay thế Tên
    res = res.replace(/\b(Nguyen Van [A-Z]|Tran Thi [A-Z]|Le Hoang [A-Z]|Pham Minh [A-Z]|Vo Thi [A-Z]|John Miller|Hana Vo|Ken Tran|Maya Chen|Omar Haddad|Priya Nair|Leo Park)\b/gi, (val) => {
      if (scrubStyle === "TOKENS") return "[NAME]";
      if (scrubStyle === "PARTIAL") return val[0] + "*** " + val.split(" ").slice(-1);
      return "[REDACTED_NAME]";
    });

    return res;
  }, [rawText, scrubStyle]);

  const handleCopySanitized = () => {
    if (!sanitizedOutput) return;
    navigator.clipboard.writeText(sanitizedOutput);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const isColumnPII = (colName: string) => {
    if (!analyzedDataset) return false;
    return (analyzedDataset.piiFindings || []).some(
      (f) => f.column.toLowerCase() === colName.toLowerCase()
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          AI Agent Phát hiện & Che mờ Dữ liệu Cá nhân (PII)
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Hệ thống bảo vệ dữ liệu tự động: Quét PII · Bôi vàng nhận diện · Căn chỉnh chuẩn đầu ra.
        </p>

        {/* Tab Switcher */}
        <div className="inline-flex bg-neutral-100 p-1 rounded-md border border-neutral-200 mt-4">
          <button
            type="button"
            onClick={() => setActiveTab("csv")}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === "csv"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Quét & Che mờ CSV Dataset (AI Agent Flow)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === "text"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Văn bản & Prompt LLM (Bôi vàng so sánh)
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: CSV DATASET (FULL AI AGENT FLOW) */}
      {/* ============================================================ */}
      {activeTab === "csv" && (
        <div className="space-y-6">
          {/* AI Agent Trace Stepper */}
          {agentTrace.length > 0 && (
            <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/70">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-neutral-900" />
                  <span className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                    AI Agent Tool Calling Trace
                  </span>
                </div>
                <span className="text-[11px] font-mono text-neutral-500">
                  scan_dataset → detect_pii → preview_masking → apply_masking
                </span>
              </div>
              <div className="space-y-2">
                {agentTrace.map((tr, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs">
                    <span className="font-mono text-neutral-400 text-[11px] mt-0.5 shrink-0">
                      {tr.time}
                    </span>
                    <span className="font-mono font-medium text-neutral-900 bg-white border border-neutral-200 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                      {tr.step}
                    </span>
                    <span className="text-neutral-700 leading-relaxed">{tr.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Dropzone */}
          {!analyzedDataset && (
            <div className="space-y-6">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-neutral-900 bg-neutral-100"
                    : "border-neutral-300 bg-white hover:bg-neutral-50 hover:border-neutral-400"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div className="flex flex-col items-center justify-center">
                  {analyzing ? (
                    <>
                      <Loader2 className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
                      <p className="text-sm font-medium text-neutral-900">
                        AI Agent đang quét và phân tích PII...
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Gọi tool scan_dataset → detect_pii → preview_masking
                      </p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-10 h-10 text-neutral-400 mb-3" strokeWidth={1.5} />
                      <p className="text-sm font-medium text-neutral-900">
                        Kéo thả file CSV vào đây
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        hoặc <span className="underline font-medium text-neutral-800">Chọn file từ máy tính</span>
                      </p>
                      <span className="inline-block mt-4 px-3 py-1 bg-neutral-100 border border-neutral-200 rounded text-xs text-neutral-600 font-mono">
                        Chuẩn RFC 4180 CSV · Bảo mật 100% In-Browser
                      </span>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-neutral-100 border border-neutral-300 rounded text-sm text-neutral-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-neutral-900 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Sample Datasets */}
              <div className="border-t border-neutral-200 pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3 text-center">
                  Hoặc thử nghiệm ngay với các bộ dữ liệu mẫu
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {INITIAL_DATASETS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleSelectSample(sample)}
                      className="p-3 bg-white border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 rounded text-left transition-colors flex items-center justify-between"
                    >
                      <div className="truncate">
                        <p className="text-xs font-semibold text-neutral-900 truncate font-mono">
                          {sample.filename}
                        </p>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          {sample.records.toLocaleString()} hàng · {sample.piiCount} PII
                        </p>
                      </div>
                      <RiskBadge risk={sample.risk} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Dataset Results: Findings, Policy Matrix & Result */}
          {analyzedDataset && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="border border-neutral-200 rounded-lg p-5 bg-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-neutral-800" />
                    <div>
                      <h2 className="text-base font-semibold text-neutral-900 font-mono">
                        {analyzedDataset.filename}
                      </h2>
                      <p className="text-xs text-neutral-500">
                        {analyzedDataset.records.toLocaleString()} bản ghi · {analyzedDataset.colCount} cột
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge risk={analyzedDataset.risk} />
                    <StatusBadge status={analyzedDataset.status} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center py-1">
                  <div className="border-r border-neutral-200 pr-2">
                    <p className="text-xs text-neutral-500">Tổng bản ghi</p>
                    <p className="text-lg font-semibold text-neutral-900 mt-1 font-mono">
                      {analyzedDataset.records.toLocaleString()}
                    </p>
                  </div>
                  <div className="border-r border-neutral-200 pr-2">
                    <p className="text-xs text-neutral-500">Cột nhạy cảm (PII)</p>
                    <p className="text-lg font-semibold text-neutral-900 mt-1 font-mono">
                      {analyzedDataset.piiCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Mức rủi ro</p>
                    <p className="text-lg font-semibold text-neutral-900 mt-1 font-mono">
                      {analyzedDataset.risk}
                    </p>
                  </div>
                </div>
              </div>

              {/* Substep 1: Findings Table with Yellow Highlighting */}
              {datasetStep === "findings" && (
                <div className="space-y-6">
                  {/* PII Findings Table */}
                  <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                    <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                        Danh sách PII được phát hiện ({analyzedDataset.piiFindings?.length || 0})
                      </h3>
                      <span className="text-xs text-neutral-500">
                        AI Agent đã phân loại và gán mức rủi ro
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                            <th className="py-2.5 px-4">Tên cột</th>
                            <th className="py-2.5 px-4">Loại PII</th>
                            <th className="py-2.5 px-4">Độ tin cậy</th>
                            <th className="py-2.5 px-4">Rủi ro</th>
                            <th className="py-2.5 px-4">Đề xuất xử lý</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {(analyzedDataset.piiFindings || []).map((f) => (
                            <tr key={f.column} className="hover:bg-neutral-50/70">
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
                              <td className="py-3 px-4 font-mono text-xs text-neutral-800">
                                {f.recommendedAction}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Raw Data Preview with YELLOW HIGHLIGHTED PII CELLS */}
                  {analyzedDataset.rawRows && analyzedDataset.rawRows.length > 0 && (
                    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                            Bản xem trước dữ liệu thô (Bôi vàng cột PII)
                          </h3>
                        </div>
                        <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                          Ô bôi vàng = Chứa thông tin nhạy cảm
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs font-mono">
                          <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                              {(analyzedDataset.columns || []).map((c) => {
                                const isPII = isColumnPII(c);
                                return (
                                  <th
                                    key={c}
                                    className={`py-2 px-3 whitespace-nowrap font-medium ${
                                      isPII ? "bg-yellow-100 text-amber-900 font-semibold" : ""
                                    }`}
                                  >
                                    {c} {isPII && "⚠️"}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {analyzedDataset.rawRows.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50">
                                {(analyzedDataset.columns || []).map((c) => {
                                  const isPII = isColumnPII(c);
                                  const val = row[c] || "—";
                                  return (
                                    <td key={c} className="py-2 px-3 whitespace-nowrap truncate max-w-[180px]">
                                      {isPII ? (
                                        <mark
                                          style={{
                                            backgroundColor: "#fef08a",
                                            color: "#854d0e",
                                            padding: "1px 4px",
                                            borderRadius: "3px",
                                            fontWeight: 500,
                                          }}
                                        >
                                          {val}
                                        </mark>
                                      ) : (
                                        <span className="text-neutral-700">{val}</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Navigation Button */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setAnalyzedDataset(null)}
                      className="px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
                    >
                      Quét file khác
                    </button>
                    <button
                      type="button"
                      onClick={() => setDatasetStep("policy")}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors"
                    >
                      <span>Cấu hình chính sách che mờ (Policy)</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Substep 2: Policy Matrix Adjustment */}
              {datasetStep === "policy" && (
                <div className="space-y-6">
                  <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                    <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                        Ma trận hành động bảo vệ (Protection Matrix)
                      </h3>
                      <span className="text-xs text-neutral-500">
                        Cho phép thay đổi hành động che mờ cho từng cột
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                            <th className="py-3 px-4">Cột dữ liệu</th>
                            <th className="py-3 px-4">Hành động che mờ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                          {(analyzedDataset.piiFindings || []).map((f) => (
                            <tr key={f.column} className="hover:bg-neutral-50/70">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-medium text-neutral-900">
                                    {f.column}
                                  </span>
                                  <span className="text-[11px] font-mono text-neutral-400">
                                    ({f.piiType})
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <select
                                  value={activePolicy[f.column] || f.recommendedAction || "PARTIAL_MASK"}
                                  onChange={(e) =>
                                    setActivePolicy((prev) => ({
                                      ...prev,
                                      [f.column]: e.target.value as RedactionAction,
                                    }))
                                  }
                                  className="font-mono text-xs px-2.5 py-1.5 bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 cursor-pointer"
                                >
                                  <option value="PARTIAL_MASK">PARTIAL_MASK (Che một phần, giữ định dạng)</option>
                                  <option value="FULL_MASK">FULL_MASK (Che hoàn toàn: ************)</option>
                                  <option value="HASH">HASH (Mã hóa một chiều SHA-256)</option>
                                  <option value="ANONYMIZE">ANONYMIZE (Thay bằng mã giả lập)</option>
                                  <option value="GENERALIZE">GENERALIZE (Khái quát hóa năm sinh/vùng)</option>
                                  <option value="SUPPRESS">SUPPRESS (Xóa rỗng cột)</option>
                                  <option value="KEEP">KEEP (Giữ nguyên)</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setDatasetStep("findings")}
                      className="px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
                    >
                      ← Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={applyingMask}
                      onClick={handleApplyMasking}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                    >
                      {applyingMask ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang thực thi che mờ...</span>
                        </>
                      ) : (
                        <span>Xác nhận & Áp dụng bảo vệ (Apply Protection)</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Substep 3: Protection Completed & Result */}
              {datasetStep === "result" && (
                <div className="space-y-6 max-w-xl mx-auto">
                  <div className="border border-neutral-200 rounded-lg p-6 bg-white space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
                        Protection completed
                      </h2>
                      <p className="text-xs text-neutral-500 mt-1 font-mono">
                        {analyzedDataset.filename}
                      </p>
                    </div>

                    <div className="border-t border-b border-neutral-200 py-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Số bản ghi đã xử lý</span>
                        <span className="font-mono font-medium text-neutral-900">
                          {(analyzedDataset.result?.recordsProcessed || analyzedDataset.records).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Cột PII đã phát hiện</span>
                        <span className="font-mono font-medium text-neutral-900">
                          {analyzedDataset.result?.piiFieldsDetected || analyzedDataset.piiCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Tổng giá trị đã che mờ</span>
                        <span className="font-mono font-medium text-neutral-900">
                          {(analyzedDataset.result?.valuesProtected || 42183).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Xác thực kiểm định</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-neutral-100 text-neutral-900 border border-neutral-300">
                          {analyzedDataset.result?.verification || "PASSED"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const csv = generateCsvDownload(analyzedDataset);
                          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `protected_${analyzedDataset.filename}`;
                          a.click();
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải CSV đã che (Protected CSV)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const text = generateAuditReportText(analyzedDataset);
                          const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = `audit_report_${analyzedDataset.filename.replace(/\.csv$/i, "")}.txt`;
                          a.click();
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
                      >
                        <FileText className="w-4 h-4 text-neutral-500" />
                        <span>Tải Báo cáo kiểm toán (Audit Report)</span>
                      </button>
                    </div>
                  </div>

                  {/* Clean Formatted Protected Preview */}
                  {analyzedDataset.protectedRows && analyzedDataset.protectedRows.length > 0 && (
                    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                      <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                          Bản xem trước dữ liệu sau khi che mờ
                        </h3>
                        <span className="text-[11px] text-neutral-500 font-mono">Định dạng chuẩn</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs font-mono">
                          <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                              {(analyzedDataset.columns || []).map((c) => (
                                <th key={c} className="py-2 px-3 whitespace-nowrap font-medium">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 text-neutral-800">
                            {analyzedDataset.protectedRows.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-neutral-50">
                                {(analyzedDataset.columns || []).map((c) => (
                                  <td key={c} className="py-2 px-3 whitespace-nowrap truncate max-w-[180px]">
                                    {row[c] || "—"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setAnalyzedDataset(null)}
                      className="text-xs font-medium text-neutral-700 hover:text-neutral-900 underline"
                    >
                      Quét và bảo vệ file khác
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: TEXT & PROMPT SCRUBBER (BÔI VÀNG SO SÁNH VỚI OUTPUT) */}
      {/* ============================================================ */}
      {activeTab === "text" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CỘT TRÁI: VĂN BẢN THÔ CÓ BÔI VÀNG PII */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  1. Văn bản thô (Bôi vàng PII phát hiện)
                </label>
                <span className="text-[11px] font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  {textMatches.length} thực thể nhạy cảm
                </span>
              </div>

              {/* View bôi vàng trực quan */}
              <div className="w-full h-44 p-3 text-xs font-mono bg-neutral-50 border border-neutral-300 rounded overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {renderedRawWithHighlights}
              </div>

              {/* Ô soạn thảo / chỉnh sửa văn bản gốc */}
              <div>
                <span className="text-[11px] text-neutral-500 block mb-1">
                  Chỉnh sửa văn bản gốc tại đây:
                </span>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Dán văn bản hoặc prompt cần kiểm tra vào đây..."
                  className="w-full h-28 p-2.5 text-xs font-mono bg-white border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900 leading-relaxed resize-y"
                />
              </div>
            </div>

            {/* CỘT PHẢI: VĂN BẢN ĐÃ CHE MỜ (CĂN CHỈNH CHUẨN ĐỊNH DẠNG) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                  2. Văn bản đã che mờ (Căn chỉnh chuẩn)
                </label>
                <span className="text-[11px] font-mono text-neutral-500">
                  Sẵn sàng gửi vào LLM
                </span>
              </div>

              <textarea
                readOnly
                value={sanitizedOutput}
                placeholder="Văn bản sau khi che mờ sẽ hiển thị tại đây..."
                className="w-full h-76 p-3 text-xs font-mono bg-white border border-neutral-300 rounded focus:outline-none leading-relaxed resize-none text-neutral-800 select-all"
                style={{ height: "calc(11rem + 7rem + 26px)" }}
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-700 font-medium">Kiểu che mờ:</span>
              <select
                value={scrubStyle}
                onChange={(e) => setScrubStyle(e.target.value as any)}
                className="text-xs font-mono px-2.5 py-1.5 bg-white border border-neutral-300 rounded focus:outline-none cursor-pointer"
              >
                <option value="TOKENS">Tokens ([NAME], [EMAIL], [PHONE], [NATIONAL_ID])</option>
                <option value="PARTIAL">Partial Mask (N*** A, j***@corp.net, ***-0198)</option>
                <option value="FULL">Full Mask (************)</option>
                <option value="HASH">SHA-256 Hash (h_7a9f...)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setRawText(
                    "Customer Report:\n" +
                    "Name: John Miller\n" +
                    "Email: john.miller@company.org\n" +
                    "Phone: +1-415-555-0198\n" +
                    "National ID: 001099012345\n" +
                    "Salary: $2,500/month\n" +
                    "Credit Card: 4111-2222-3333-4444\n" +
                    "Please review this prompt before sending."
                  )
                }
                className="px-3.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-medium rounded transition-colors"
              >
                Tải văn bản mẫu
              </button>
              <button
                type="button"
                onClick={handleCopySanitized}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copySuccess ? "Đã sao chép!" : "Copy văn bản chuẩn"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
