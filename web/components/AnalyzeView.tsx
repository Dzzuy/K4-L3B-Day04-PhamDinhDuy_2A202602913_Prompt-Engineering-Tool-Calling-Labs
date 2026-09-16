"use client";

import {
  useState,
  useRef,
  DragEvent,
  ChangeEvent,
  useEffect,
} from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  AlertCircle,
  Loader2,
  Copy,
} from "@/components/icons";

import {
  analyzeDatasetContent,
  parseCsvText,
  saveDataset,
  INITIAL_DATASETS,
} from "@/lib/data-store";

import { uploadCsv } from "@/lib/api";

import type { DatasetItem } from "@/lib/types";
import { RiskBadge, StatusBadge } from "@/components/Badges";

type ScrubStyle = "TOKENS" | "PARTIAL" | "REDACTED" | "HASH";

type PiiMatch = {
  start: number;
  end: number;
  value: string;
  type: "EMAIL" | "PHONE" | "NATIONAL_ID" | "NAME";
};

type TextSegment = {
  original: string;
  sanitized: string;
  changed: boolean;
  type?: PiiMatch["type"];
};

export default function AnalyzeView() {
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<"csv" | "text">("csv");

  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedDataset, setAnalyzedDataset] =
    useState<DatasetItem | null>(null);

  // Text scrubber
  const [rawText, setRawText] = useState("");
  const [scrubStyle, setScrubStyle] =
    useState<ScrubStyle>("TOKENS");
  const [copySuccess, setCopySuccess] = useState(false);

  /*
   * ------------------------------------------------------------
   * CSV
   * ------------------------------------------------------------
   */

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a valid .csv file.");
      return;
    }

    setError(null);
    setAnalyzing(true);
    setAnalyzedDataset(null);

    try {
      const text = await file.text();

      const { columns, rows } = parseCsvText(text);

      const dataset = analyzeDatasetContent(
        file.name,
        columns,
        rows
      );

      saveDataset(dataset);

      try {
        await uploadCsv(file);
      } catch {
        // Client store fallback
      }

      setAnalyzedDataset(dataset);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to parse CSV file."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDragOver = (
    e: DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (
    e: DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (
    e: DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];

    if (file) {
      void processFile(file);
    }
  };

  const handleFileChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (file) {
      void processFile(file);
    }
  };

  const handleSelectSample = (
    sample: DatasetItem
  ) => {
    saveDataset(sample);
    setAnalyzedDataset(sample);
  };

  /*
   * ------------------------------------------------------------
   * PII DETECTION
   * ------------------------------------------------------------
   */

  const detectPii = (text: string): PiiMatch[] => {
    if (!text) {
      return [];
    }

    const matches: PiiMatch[] = [];

    /*
     * EMAIL
     */
    const emailRegex =
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

    /*
     * PHONE
     *
     * Supports:
     * 0912345678
     * 098-123-4567
     * +84 912 345 678
     * +1-415-555-0198
     */
    const phoneRegex =
      /(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{3,4}(?:[-.\s]?\d{3,4})?(?!\d)/g;

    /*
     * CCCD / National ID
     *
     * Vietnamese CCCD commonly 12 digits.
     * Also allows 9-12 digits for demo purposes.
     */
    const nationalIdRegex =
      /\b\d{9,12}\b/g;

    /*
     * Vietnamese names.
     *
     * Supports examples:
     * Nguyễn Văn An
     * Trần Thị Bình
     * Lê Minh Hoàng
     * Phạm Văn Nam
     *
     * Also supports English demo names.
     */
    const nameRegex =
      /\b(?:Nguyễn|Nguyen|Trần|Tran|Lê|Le|Phạm|Pham|Hoàng|Hoang|Huỳnh|Huynh|Phan|Vũ|Vu|Võ|Vo|Đặng|Dang|Bùi|Bui|Đỗ|Do|Hồ|Ho|Ngô|Ngo|Dương|Duong|Đinh|Dinh|John|Hana|Ken)\s+(?:Thị|Văn|Minh|Mỹ|Van|Thi|Minh)?\s*[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){0,2}\b/g;

    const pushMatches = (
      regex: RegExp,
      type: PiiMatch["type"]
    ) => {
      for (const match of text.matchAll(regex)) {
        const value = match[0];
        const start = match.index ?? 0;

        matches.push({
          start,
          end: start + value.length,
          value,
          type,
        });
      }
    };

    pushMatches(emailRegex, "EMAIL");
    pushMatches(phoneRegex, "PHONE");
    pushMatches(nationalIdRegex, "NATIONAL_ID");
    pushMatches(nameRegex, "NAME");

    /*
     * Remove overlapping matches.
     *
     * Example:
     * 012345678901
     *
     * should be NATIONAL_ID,
     * not PHONE + NATIONAL_ID.
     */
    matches.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }

      return b.end - a.end;
    });

    const filtered: PiiMatch[] = [];

    for (const match of matches) {
      const previous = filtered[filtered.length - 1];

      if (
        previous &&
        match.start < previous.end
      ) {
        continue;
      }

      filtered.push(match);
    }

    return filtered;
  };

  /*
   * ------------------------------------------------------------
   * MASKING
   * ------------------------------------------------------------
   */

  const sanitizeValue = (
    value: string,
    type: PiiMatch["type"]
  ) => {
    if (scrubStyle === "TOKENS") {
      switch (type) {
        case "EMAIL":
          return "[EMAIL]";

        case "PHONE":
          return "[PHONE]";

        case "NATIONAL_ID":
          return "[NATIONAL_ID]";

        case "NAME":
          return "[NAME]";
      }
    }

    if (scrubStyle === "PARTIAL") {
      switch (type) {
        case "EMAIL": {
          const [local, domain] =
            value.split("@");

          if (!domain) {
            return "[EMAIL]";
          }

          const visible =
            local.length > 0
              ? local[0]
              : "";

          return `${visible}***@${domain}`;
        }

        case "PHONE": {
          const digits =
            value.replace(/\D/g, "");

          return `***-***-${digits.slice(-4)}`;
        }

        case "NATIONAL_ID": {
          return `********${value.slice(-4)}`;
        }

        case "NAME": {
          const parts =
            value.split(/\s+/);

          if (parts.length === 1) {
            return `${parts[0][0]}***`;
          }

          return `${parts[0]} ${parts
            .slice(1)
            .map(() => "***")
            .join(" ")}`;
        }
      }
    }

    if (scrubStyle === "HASH") {
      let hash = 0;

      for (
        let i = 0;
        i < value.length;
        i++
      ) {
        hash =
          (hash << 5) -
          hash +
          value.charCodeAt(i);

        hash |= 0;
      }

      return `h_${Math.abs(hash).toString(16)}`;
    }

    return "[REDACTED]";
  };

  /*
   * Convert text into:
   *
   * normal text
   * PII text
   * normal text
   * PII text
   */
  const getTextSegments = (
    text: string
  ): TextSegment[] => {
    if (!text) {
      return [];
    }

    const matches = detectPii(text);

    if (matches.length === 0) {
      return [
        {
          original: text,
          sanitized: text,
          changed: false,
        },
      ];
    }

    const segments: TextSegment[] = [];

    let cursor = 0;

    for (const match of matches) {
      if (match.start > cursor) {
        const normalText = text.slice(
          cursor,
          match.start
        );

        segments.push({
          original: normalText,
          sanitized: normalText,
          changed: false,
        });
      }

      const sanitized =
        sanitizeValue(
          match.value,
          match.type
        );

      segments.push({
        original: match.value,
        sanitized,
        changed:
          match.value !== sanitized,
        type: match.type,
      });

      cursor = match.end;
    }

    if (cursor < text.length) {
      const normalText =
        text.slice(cursor);

      segments.push({
        original: normalText,
        sanitized: normalText,
        changed: false,
      });
    }

    return segments;
  };

  const sanitizedText =
    getTextSegments(rawText)
      .map((segment) => segment.sanitized)
      .join("");

  /*
   * ------------------------------------------------------------
   * HIGHLIGHT SCROLL SYNC
   * ------------------------------------------------------------
   */

  const syncScroll = () => {
    if (
      !rawTextareaRef.current ||
      !highlightRef.current
    ) {
      return;
    }

    highlightRef.current.scrollTop =
      rawTextareaRef.current.scrollTop;

    highlightRef.current.scrollLeft =
      rawTextareaRef.current.scrollLeft;
  };

  useEffect(() => {
    syncScroll();
  }, [rawText]);

  /*
   * ------------------------------------------------------------
   * COPY
   * ------------------------------------------------------------
   */

  const handleCopyText = async () => {
    if (!sanitizedText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        sanitizedText
      );

      setCopySuccess(true);

      setTimeout(() => {
        setCopySuccess(false);
      }, 2500);
    } catch {
      setCopySuccess(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * SAMPLE
   * ------------------------------------------------------------
   */

  const loadSamplePrompt = () => {
    setRawText(
      `Subject: Account Audit
Name: Nguyễn Văn An
Email: nguyenvanan@example.com
Phone: 0912345678
CCCD: 012345678901
Address: 123 Nguyễn Trãi, Thanh Xuân, Hà Nội

Please review this customer information and prepare a report.
The information should be protected before being sent to an LLM.`
    );
  };

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <div className="max-w-3xl mx-auto py-6">
      {/* HEADER */}

      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Analyze & Mask PII
        </h1>

        <p className="text-sm text-neutral-500 mt-2 mb-4">
          Detect personal information, redact sensitive
          data, and assess privacy risks.
        </p>

        {/* TABS */}

        <div className="inline-flex bg-neutral-100 p-1 rounded-md border border-neutral-200">
          <button
            type="button"
            onClick={() =>
              setActiveTab("csv")
            }
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === "csv"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            CSV Dataset (PII Masker)
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveTab("text")
            }
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === "text"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Text & Prompt Scrubber
          </button>
        </div>
      </div>

      {/* ====================================================== */}
      {/* CSV TAB */}
      {/* ====================================================== */}

      {activeTab === "csv" && (
        <>
          {!analyzedDataset && (
            <div className="space-y-6">
              {/* UPLOAD */}

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() =>
                  fileInputRef.current?.click()
                }
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
                        Analyzing dataset & scanning PII...
                      </p>

                      <p className="text-xs text-neutral-500 mt-1">
                        Detecting personal identifiers and risk classification
                      </p>
                    </>
                  ) : (
                    <>
                      <UploadCloud
                        className="w-10 h-10 text-neutral-400 mb-3"
                        strokeWidth={1.5}
                      />

                      <p className="text-sm font-medium text-neutral-900">
                        Drop CSV file here
                      </p>

                      <p className="text-xs text-neutral-500 mt-1">
                        or{" "}
                        <span className="underline font-medium text-neutral-800">
                          Browse
                        </span>{" "}
                        from your computer
                      </p>

                      <span className="inline-block mt-4 px-3 py-1 bg-neutral-100 border border-neutral-200 rounded text-xs text-neutral-600">
                        Supports RFC 4180 CSV up to 15MB ·
                        100% In-Browser Privacy
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* ERROR */}

              {error && (
                <div className="p-3 bg-neutral-100 border border-neutral-300 rounded text-sm text-neutral-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-neutral-900 shrink-0" />

                  <span>{error}</span>
                </div>
              )}

              {/* SAMPLE DATASETS */}

              <div className="border-t border-neutral-200 pt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-3 text-center">
                  Or test pre-loaded sample datasets
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {INITIAL_DATASETS.map(
                    (sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() =>
                          handleSelectSample(
                            sample
                          )
                        }
                        className="p-3 bg-white border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 rounded text-left transition-colors flex items-center justify-between"
                      >
                        <div className="truncate">
                          <p className="text-xs font-semibold text-neutral-900 truncate">
                            {sample.filename}
                          </p>

                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            {sample.records.toLocaleString()}{" "}
                            rows · {sample.piiCount} PII
                          </p>
                        </div>

                        <RiskBadge
                          risk={sample.risk}
                        />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ANALYZED DATASET */}

          {analyzedDataset && (
            <div className="space-y-6">
              <div className="border border-neutral-200 rounded-lg p-5 bg-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-neutral-800" />

                    <div>
                      <h2 className="text-base font-semibold text-neutral-900">
                        {analyzedDataset.filename}
                      </h2>

                      <p className="text-xs text-neutral-500">
                        {analyzedDataset.records.toLocaleString()}{" "}
                        records ·{" "}
                        {analyzedDataset.colCount}{" "}
                        columns
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <RiskBadge
                      risk={analyzedDataset.risk}
                    />

                    <StatusBadge
                      status={
                        analyzedDataset.status
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center py-2">
                  <div className="border-r border-neutral-200 pr-2">
                    <p className="text-xs text-neutral-500">
                      Total Records
                    </p>

                    <p className="text-lg font-semibold text-neutral-900 mt-1">
                      {analyzedDataset.records.toLocaleString()}
                    </p>
                  </div>

                  <div className="border-r border-neutral-200 pr-2">
                    <p className="text-xs text-neutral-500">
                      PII Fields Found
                    </p>

                    <p className="text-lg font-semibold text-neutral-900 mt-1">
                      {analyzedDataset.piiCount}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-neutral-500">
                      Risk Assessment
                    </p>

                    <p className="text-lg font-semibold text-neutral-900 mt-1">
                      {analyzedDataset.risk}
                    </p>
                  </div>
                </div>
              </div>

              {/* PII FINDINGS */}

              <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    PII Findings (
                    {analyzedDataset.piiFindings.length}
                    )
                  </h3>

                  <span className="text-xs text-neutral-500">
                    Rule-based & AI classification
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] uppercase tracking-wider text-neutral-500 font-medium">
                        <th className="py-2.5 px-4">
                          Column
                        </th>

                        <th className="py-2.5 px-4">
                          PII Type
                        </th>

                        <th className="py-2.5 px-4">
                          Confidence
                        </th>

                        <th className="py-2.5 px-4">
                          Risk
                        </th>

                        <th className="py-2.5 px-4">
                          Recommended Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-neutral-200">
                      {analyzedDataset.piiFindings.map(
                        (f) => (
                          <tr
                            key={f.column}
                            className="hover:bg-neutral-50/70 transition-colors"
                          >
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
                              <RiskBadge
                                risk={f.risk}
                              />
                            </td>

                            <td className="py-3 px-4 font-mono text-xs text-neutral-800">
                              {f.recommendedAction}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ACTIONS */}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setAnalyzedDataset(null)
                  }
                  className="w-full sm:w-auto px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-sm font-medium rounded transition-colors"
                >
                  Analyze Another File
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Link
                    href={`/datasets/${analyzedDataset.id}`}
                    className="w-full sm:w-auto text-center px-4 py-2 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-sm font-medium rounded transition-colors"
                  >
                    View Details
                  </Link>

                  <Link
                    href={`/datasets/${analyzedDataset.id}/policy`}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-black hover:bg-neutral-800 text-white text-sm font-medium rounded transition-colors"
                  >
                    <span>
                      Create Protection Policy
                    </span>

                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ====================================================== */}
      {/* TEXT TAB */}
      {/* ====================================================== */}

      {activeTab === "text" && (
        <div className="space-y-4">
          {/* EDITOR */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ================================================= */}
            {/* RAW TEXT */}
            {/* ================================================= */}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-600">
                  Input Raw Text / Prompt
                </label>

                <span className="text-[10px] text-neutral-400">
                  Detected PII is highlighted
                </span>
              </div>

              <div className="relative w-full h-[500px] rounded border border-neutral-300 bg-white overflow-hidden">
                {/* Highlight layer */}

                <div
                  ref={highlightRef}
                  aria-hidden="true"
                  className="absolute inset-0 p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words overflow-hidden pointer-events-none text-neutral-900"
                >
                  {rawText ? (
                    getTextSegments(
                      rawText
                    ).map(
                      (segment, index) =>
                        segment.changed ? (
                          <mark
                            key={index}
                            className="bg-yellow-200 text-neutral-900 rounded-sm"
                          >
                            {segment.original}
                          </mark>
                        ) : (
                          <span key={index}>
                            {segment.original}
                          </span>
                        )
                    )
                  ) : (
                    <span className="text-neutral-400">
                      Paste sensitive text, email,
                      phone, or prompt here...
                    </span>
                  )}
                </div>

                {/* Real textarea */}

                <textarea
                  ref={rawTextareaRef}
                  value={rawText}
                  onChange={(e) =>
                    setRawText(e.target.value)
                  }
                  onScroll={syncScroll}
                  spellCheck={false}
                  className="absolute inset-0 w-full h-full p-3 text-xs font-mono leading-relaxed resize-none bg-transparent text-transparent caret-neutral-900 outline-none selection:bg-yellow-100 selection:text-neutral-900 overflow-auto"
                  aria-label="Input Raw Text"
                />
              </div>

              {/* Detection summary */}

              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-neutral-500">
                  {detectPii(rawText).length}{" "}
                  PII item
                  {detectPii(rawText).length !==
                  1
                    ? "s"
                    : ""}{" "}
                  detected
                </span>

                {detectPii(rawText).length >
                  0 && (
                  <span className="text-[11px] text-yellow-700">
                    Highlighted fields will be masked
                  </span>
                )}
              </div>
            </div>

            {/* ================================================= */}
            {/* OUTPUT */}
            {/* ================================================= */}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-600">
                  Sanitized Output
                </label>

                <span className="text-[10px] text-neutral-400">
                  Safe for LLM
                </span>
              </div>

              <div className="w-full h-[500px] p-3 text-xs font-mono bg-neutral-50 border border-neutral-300 rounded leading-relaxed whitespace-pre-wrap break-words overflow-auto text-neutral-800">
                {rawText ? (
                  getTextSegments(
                    rawText
                  ).map(
                    (segment, index) =>
                      segment.changed ? (
                        <span
                          key={index}
                          className="text-neutral-900"
                        >
                          {segment.sanitized}
                        </span>
                      ) : (
                        <span key={index}>
                          {segment.original}
                        </span>
                      )
                  )
                ) : (
                  <span className="text-neutral-400">
                    Redacted output appears here in
                    real-time...
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-neutral-500">
                  Output automatically updates
                </span>

                {rawText && (
                  <span className="text-[11px] text-neutral-600">
                    {scrubStyle ===
                      "TOKENS" &&
                      "Token replacement"}

                    {scrubStyle ===
                      "PARTIAL" &&
                      "Partial masking"}

                    {scrubStyle ===
                      "REDACTED" &&
                      "Full redaction"}

                    {scrubStyle ===
                      "HASH" &&
                      "Hash replacement"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* CONTROLS */}
          {/* ================================================= */}

          <div className="border border-neutral-200 rounded-lg bg-neutral-50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* STYLE */}

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-600">
                  Replacement Style:
                </span>

                <select
                  value={scrubStyle}
                  onChange={(e) =>
                    setScrubStyle(
                      e.target
                        .value as ScrubStyle
                    )
                  }
                  className="text-xs font-mono px-2.5 py-1.5 bg-white border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-900"
                >
                  <option value="TOKENS">
                    Tokens ([NAME], [EMAIL], [PHONE])
                  </option>

                  <option value="PARTIAL">
                    Partial Mask
                  </option>

                  <option value="REDACTED">
                    [REDACTED]
                  </option>

                  <option value="HASH">
                    Cryptographic Hash
                  </option>
                </select>
              </div>

              {/* BUTTONS */}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSamplePrompt}
                  className="px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 text-xs font-medium rounded transition-colors"
                >
                  Load Sample
                </button>

                <button
                  type="button"
                  onClick={handleCopyText}
                  disabled={!sanitizedText}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />

                  <span>
                    {copySuccess
                      ? "Copied!"
                      : "Copy Sanitized Text"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* ================================================= */}
          {/* DETECTION DETAILS */}
          {/* ================================================= */}

          {rawText &&
            detectPii(rawText).length >
              0 && (
              <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-900">
                      Detected PII
                    </h3>

                    <span className="text-xs text-neutral-500">
                      {
                        detectPii(rawText)
                          .length
                      }{" "}
                      detected
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-neutral-100">
                  {detectPii(rawText).map(
                    (item, index) => (
                      <div
                        key={`${item.start}-${index}`}
                        className="px-4 py-2.5 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-neutral-600">
                              {item.type}
                            </span>

                            <span className="text-xs font-mono text-neutral-900 truncate">
                              {item.value}
                            </span>
                          </div>
                        </div>

                        <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />

                        <span className="text-xs font-mono text-neutral-600 shrink-0">
                          {sanitizeValue(
                            item.value,
                            item.type
                          )}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  );
}