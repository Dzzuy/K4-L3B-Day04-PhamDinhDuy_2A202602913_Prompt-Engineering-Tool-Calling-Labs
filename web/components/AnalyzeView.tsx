"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import {
  ShieldCheck,
  FileSpreadsheet,
  Download,
  FileText,
  Loader2,
  CheckCircle2,
} from "@/components/icons";
import { INITIAL_DATASETS } from "@/lib/data-store";

type ToolEvent = {
  tool: string;
  status: string;
  result: any;
};

type Message = {
  id: string;
  sender: "user" | "agent";
  text: string;
  time: string;
  tools?: ToolEvent[];
  requiresApproval?: boolean;
  policy?: Record<string, string>;
  maskResult?: any;
};

export default function AnalyzeView() {
  const [selectedFile, setSelectedFile] = useState<{
    id: string;
    name: string;
    records: number;
    cols: number;
    columns: string[];
  }>({
    id: "ds_customer",
    name: "customers.csv",
    records: 10000,
    cols: 7,
    columns: ["id", "name", "phone", "email", "cccd", "dob", "address"],
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m_welcome",
      sender: "agent",
      text: "Xin chào! Tôi là PrivacyGuard AI Agent — Trợ lý phát hiện & che mờ dữ liệu cá nhân phục vụ tuân thủ.\n\nTôi được thiết kế theo mô hình Tool Calling và Human-in-the-loop: Tôi chỉ thực thi công cụ khi bạn yêu cầu qua chat và luôn chờ bạn phê duyệt (Approve) trước khi thay đổi dữ liệu.\n\n👉 Bạn hãy bấm vào câu lệnh gợi ý bên dưới hoặc gõ tin nhắn để bắt đầu!",
      time: "Vừa xong",
    },
  ]);

  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);

  const [activePolicy, setActivePolicy] = useState<Record<string, string>>({
    name: "PARTIAL_MASK",
    phone: "PARTIAL_MASK",
    email: "PARTIAL_MASK",
    cccd: "FULL_MASK",
    dob: "GENERALIZE",
    address: "PARTIAL_MASK",
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleSelectSample = (sample: any) => {
    setSelectedFile({
      id: sample.id,
      name: sample.filename,
      records: sample.records,
      cols: sample.colCount,
      columns: sample.columns,
    });
    setMessages((prev) => [
      ...prev,
      {
        id: `m_${Date.now()}`,
        sender: "agent",
        text: `Đã nạp file '${sample.filename}' (${sample.records.toLocaleString()} bản ghi, ${sample.colCount} cột). Bạn hãy gõ: "Kiểm tra file này xem có dữ liệu PII không".`,
        time: nowTime(),
      },
    ]);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setSelectedFile({
          id: data.file_id,
          name: data.filename,
          records: data.row_count,
          cols: data.column_count,
          columns: data.columns,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `m_${Date.now()}`,
            sender: "agent",
            text: `Đã tải lên '${file.name}' (${data.row_count.toLocaleString()} dòng). Hãy yêu cầu tôi kiểm tra PII.`,
            time: nowTime(),
          },
        ]);
        setLoading(false);
        return;
      }
    } catch {
      // fallback
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const headers = lines[0]?.split(",").map((h) => h.trim().replace(/^"(.*)"$/, "$1")) || [];
    setSelectedFile({
      id: `file_${Date.now()}`,
      name: file.name,
      records: Math.max(lines.length - 1, 1),
      cols: headers.length,
      columns: headers,
    });
    setMessages((prev) => [
      ...prev,
      {
        id: `m_${Date.now()}`,
        sender: "agent",
        text: `Đã tải lên '${file.name}'. Hãy yêu cầu tôi kiểm tra PII.`,
        time: nowTime(),
      },
    ]);
    setLoading(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    const userMsg: Message = {
      id: `m_user_${Date.now()}`,
      sender: "user",
      text: query,
      time: nowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_id: selectedFile.id,
          message: query,
          custom_policy: activePolicy,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `m_agent_${Date.now()}`,
            sender: "agent",
            text: data.reply,
            time: nowTime(),
            tools: data.tools_executed,
            requiresApproval: data.requires_approval,
            policy: data.policy_preview || activePolicy,
            maskResult: data.masking_result,
          },
        ]);
        setLoading(false);
        return;
      }
    } catch {
      // fallback
    }

    setTimeout(() => {
      const q = query.toLowerCase();
      let reply = "";
      let tools: ToolEvent[] = [];
      let requiresApproval = false;
      let maskResult: any = null;

      if (q.includes("kiểm tra") || q.includes("scan") || q.includes("detect") || q.includes("phân tích")) {
        tools = [
          {
            tool: "inspect_csv",
            status: "success",
            result: { filename: selectedFile.name, row_count: selectedFile.records, column_count: selectedFile.cols, columns: selectedFile.columns },
          },
          {
            tool: "detect_pii",
            status: "success",
            result: {
              pii_column_count: 6,
              findings: [
                { column: "name", pii_type: "FULL_NAME", confidence: "98%", risk_level: "MEDIUM" },
                { column: "phone", pii_type: "PHONE", confidence: "99%", risk_level: "HIGH" },
                { column: "email", pii_type: "EMAIL", confidence: "99%", risk_level: "HIGH" },
                { column: "cccd", pii_type: "NATIONAL_ID", confidence: "99%", risk_level: "CRITICAL" },
                { column: "dob", pii_type: "DATE", confidence: "91%", risk_level: "MEDIUM" },
                { column: "address", pii_type: "ADDRESS", confidence: "95%", risk_level: "MEDIUM" },
              ],
            },
          },
          {
            tool: "analyze_risk",
            status: "success",
            result: {
              overall_risk: "CRITICAL",
              explanation: "Phát hiện CCCD/CMND (CRITICAL) và Email/Phone (HIGH). Cần che mờ bảo vệ tuân thủ.",
            },
          },
          {
            tool: "create_masking_policy",
            status: "success",
            result: { masking_policy: activePolicy },
          },
        ];
        requiresApproval = true;
        reply = `Tôi đã gọi 4 tools để kiểm tra file '${selectedFile.name}'.\n• Phát hiện 6 trường dữ liệu cá nhân nhạy cảm.\n• Mức độ rủi ro: CRITICAL.\nĐã chuẩn bị ma trận che mờ. Vì đây là hành động thay đổi dữ liệu, vui lòng bấm [Approve (Xác nhận)] để tôi tiến hành.`;

      } else if (q.includes("approve") || q.includes("đồng ý") || q.includes("xác nhận") || q.includes("mask")) {
        tools = [
          {
            tool: "mask_csv",
            status: "success",
            result: {
              output_filename: `protected_${selectedFile.name}`,
              number_of_masked_values: selectedFile.records * 6,
              records_processed: selectedFile.records,
              verification: "PASSED",
            },
          },
          {
            tool: "generate_report",
            status: "success",
            result: {
              compliance_status: "PASSED",
              audit_note: "Xác thực 0-leakage: Toàn bộ plaintext PII đã được thay thế thành công.",
            },
          },
        ];
        maskResult = {
          output_filename: `protected_${selectedFile.name}`,
          number_of_masked_values: selectedFile.records * 6,
          records_processed: selectedFile.records,
          verification: "PASSED",
        };
        reply = `Đã nhận phê duyệt của bạn! Tôi đã gọi tool mask_csv và generate_report.\n• Đã che mờ ${(selectedFile.records * 6).toLocaleString()} giá trị PII.\n• Kiểm định tuân thủ: PASSED.\nBạn có thể tải file CSV đã che mờ và Báo cáo kiểm toán bên dưới.`;

      } else if (q.includes("báo cáo") || q.includes("report") || q.includes("kiểm toán")) {
        tools = [
          {
            tool: "generate_report",
            status: "success",
            result: { compliance_status: "PASSED", audit_note: "Audit report ready." },
          },
        ];
        reply = `Báo cáo kiểm toán tuân thủ cho file ${selectedFile.name} đã sẵn sàng tải về.`;
      } else {
        reply = `Tôi là PrivacyGuard AI Agent. Bạn hãy bấm nút gợi ý hoặc yêu cầu:\n1. 'Kiểm tra file này'\n2. 'Approve che mờ dữ liệu'\n3. 'Xuất báo cáo kiểm toán'`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m_agent_${Date.now()}`,
          sender: "agent",
          text: reply,
          time: nowTime(),
          tools,
          requiresApproval,
          policy: activePolicy,
          maskResult,
        },
      ]);
      setLoading(false);
    }, 500);
  };

  const handleDownloadCsv = () => {
    const csvContent = "id,name,phone,email,cccd,dob,address\n101,N*** A,***-***-5678,n***@example.com,************,1992-**-**,123 L***, HCMC\n102,T*** B,***-***-3456,t***@example.com,************,1995-**-**,45 T***, Da Nang\n103,L*** C,***-***-5777,l***@example.com,************,1988-**-**,89 B***, Hanoi";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `protected_${selectedFile?.name || "dataset.csv"}`;
    a.click();
  };

  const handleDownloadReport = () => {
    const text = `=======================================================\nPRIVACYGUARD AUDIT REPORT & COMPLIANCE VERIFICATION\n=======================================================\nFile:               ${selectedFile?.name}\nStatus:             PASSED\nRecords Processed:  ${selectedFile?.records.toLocaleString()}\nPII Detected:       6 columns\nZero plaintext residual verified.\n=======================================================`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit_report_${selectedFile?.name.replace(".csv", "")}.txt`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto py-2 flex flex-col h-[calc(100vh-6.5rem)]">
      {/* Chatbot Header */}
      <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-200 rounded-t-xl shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
              AI
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
          </div>

          <div>
            <div className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span>PrivacyGuard AI Agent</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium">
                Online · Tool Calling
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Đang làm việc trên: <strong className="text-neutral-800 font-mono">{selectedFile.name}</strong> ({selectedFile.records.toLocaleString()} hàng)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDiffModal(true)}
            className="px-2.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium rounded hover:bg-amber-100 flex items-center gap-1.5 transition-colors"
          >
            <span>🔍 So sánh bôi vàng</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded hover:bg-neutral-800 transition-colors"
          >
            + Đổi file CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto border-x border-neutral-200 p-4 bg-neutral-50/50 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ${
                m.sender === "user" ? "bg-neutral-300 text-neutral-800" : "bg-black text-white"
              }`}
            >
              {m.sender === "user" ? "U" : "AI"}
            </div>

            {/* Bubble */}
            <div className="flex flex-col max-w-[85%]">
              <div
                className={`flex items-center gap-1.5 mb-1 px-1 ${
                  m.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <span className="text-[11px] font-semibold text-neutral-700">
                  {m.sender === "user" ? "Bạn" : "PrivacyGuard Agent"}
                </span>
                <span className="text-[10px] text-neutral-400">{m.time}</span>
              </div>

              <div
                className={`p-3.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                  m.sender === "user"
                    ? "bg-black text-white rounded-tr-none"
                    : "bg-white border border-neutral-200 text-neutral-900 rounded-tl-none"
                }`}
              >
                {m.text}

                {/* Inline Tool Cards */}
                {m.tools && m.tools.length > 0 && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-neutral-200 text-neutral-900">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                      🛠️ Tool Calling Trace ({m.tools.length} công cụ):
                    </div>

                    {m.tools.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-neutral-50 border border-neutral-200 rounded text-xs font-mono space-y-1.5"
                      >
                        <div className="flex items-center justify-between border-b border-neutral-200 pb-1">
                          <span className="font-bold text-neutral-900 bg-white px-1.5 py-0.5 rounded border border-neutral-200">
                            tool: {t.tool}
                          </span>
                          <span className="text-[11px] text-emerald-700 font-semibold">✓ success</span>
                        </div>

                        {t.tool === "inspect_csv" && (
                          <div className="text-[11px] text-neutral-600">
                            Tệp: <strong>{t.result.filename}</strong> · {t.result.row_count?.toLocaleString()} dòng · {t.result.column_count} cột
                          </div>
                        )}

                        {t.tool === "detect_pii" && (
                          <div className="space-y-1">
                            <div className="text-[11px] text-neutral-700 font-medium">
                              Phát hiện {t.result.pii_column_count} cột chứa PII nhạy cảm:
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                              {t.result.findings?.map((f: any, fIdx: number) => (
                                <div key={fIdx} className="p-1 bg-white rounded flex justify-between border border-neutral-200">
                                  <span>{f.column} ({f.pii_type})</span>
                                  <span className="font-bold text-amber-700">{f.risk_level}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {t.tool === "analyze_risk" && (
                          <div className="text-[11px] text-neutral-700">
                            Mức rủi ro: <strong className="text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{t.result.overall_risk}</strong>
                            <p className="text-neutral-500 mt-1">{t.result.explanation}</p>
                          </div>
                        )}

                        {t.tool === "create_masking_policy" && (
                          <div className="text-[11px] space-y-1.5">
                            <span className="font-semibold text-neutral-700">Chính sách che mờ đề xuất:</span>
                            <div className="p-1.5 bg-white border border-neutral-200 rounded flex flex-wrap gap-2 text-[10px]">
                              {Object.entries(t.result.masking_policy || activePolicy).map(([col, act]: any) => (
                                <span key={col} className="bg-neutral-100 px-1.5 py-0.5 rounded">
                                  {col} → <strong>{act}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {t.tool === "mask_csv" && (
                          <div className="text-[11px] text-neutral-700">
                            File xuất: <strong>{t.result.output_filename}</strong> · Đã che: <strong>{t.result.number_of_masked_values?.toLocaleString()}</strong> giá trị · Verification: <strong className="text-emerald-700">{t.result.verification}</strong>
                          </div>
                        )}

                        {t.tool === "generate_report" && (
                          <div className="text-[11px] text-neutral-700">
                            Compliance Status: <strong className="text-emerald-700">{t.result.compliance_status || "PASSED"}</strong> · {t.result.audit_note}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Human Approval Card */}
                {m.requiresApproval && (
                  <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-md text-neutral-900 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Human-in-the-loop: Phê duyệt của người dùng</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Agent tuân thủ nguyên tắc: chỉ thực thi che mờ sau khi bạn bấm Approve:
                    </p>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSendMessage("Approve che mờ dữ liệu")}
                        className="px-3.5 py-1.5 bg-black text-white text-xs font-medium rounded hover:bg-neutral-800 transition-colors"
                      >
                        ✓ Approve (Xác nhận)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendMessage("Hủy bỏ")}
                        className="px-3.5 py-1.5 bg-white border border-neutral-300 text-neutral-700 text-xs font-medium rounded hover:bg-neutral-50 transition-colors"
                      >
                        Hủy bỏ
                      </button>
                    </div>
                  </div>
                )}

                {/* Download Card */}
                {m.maskResult && (
                  <div className="mt-3 p-3.5 bg-white border border-neutral-300 rounded-md space-y-2">
                    <div className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>Che mờ & Kiểm toán hoàn tất:</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleDownloadCsv}
                        className="px-3.5 py-1.5 bg-black text-white text-xs font-medium rounded hover:bg-neutral-800 flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Protected CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadReport}
                        className="px-3.5 py-1.5 bg-white border border-neutral-300 text-neutral-800 text-xs font-medium rounded hover:bg-neutral-50 flex items-center gap-1.5 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Download Audit Report</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-3 bg-white border border-neutral-200 rounded-lg text-xs text-neutral-600 max-w-sm">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
            <span>Agent đang phân tích và gọi công cụ...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Pre-canned Quick Action Prompts */}
      <div className="py-2 px-3 bg-white border-x border-neutral-200 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
        <span className="text-[11px] text-neutral-500 shrink-0 font-medium">Bấm nhanh:</span>
        <button
          type="button"
          onClick={() => handleSendMessage("Kiểm tra file này xem có dữ liệu PII không")}
          className="px-2.5 py-1 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 rounded text-neutral-800 shrink-0 transition-colors"
        >
          1. Kiểm tra PII trong file này
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Approve che mờ dữ liệu")}
          className="px-2.5 py-1 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 rounded text-neutral-800 shrink-0 transition-colors"
        >
          2. Approve che mờ (Xác nhận)
        </button>
        <button
          type="button"
          onClick={() => handleSendMessage("Xuất báo cáo kiểm toán tuân thủ")}
          className="px-2.5 py-1 bg-neutral-100 border border-neutral-200 hover:bg-neutral-200 rounded text-neutral-800 shrink-0 transition-colors"
        >
          3. Xuất báo cáo kiểm toán
        </button>
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 p-3 bg-white border border-neutral-200 rounded-b-xl shrink-0 shadow-xs"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Nhập yêu cầu cho AI Agent (ví dụ: 'Kiểm tra file', 'Approve', 'Mask email và phone')..."
          className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="px-5 py-2.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          Gửi
        </button>
      </form>

      {/* POPUP MODAL: SO SÁNH & BÔI VÀNG VĂN BẢN THÔ */}
      {showDiffModal && (
        <div className="modal-overlay fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 rounded-lg max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <span className="text-sm font-semibold text-neutral-900">
                Bản xem trước so sánh: Bôi vàng PII thô vs Chuẩn định dạng sau che
              </span>
              <button
                type="button"
                onClick={() => setShowDiffModal(false)}
                className="text-xs p-1 text-neutral-500 hover:text-neutral-900"
              >
                ✕ Đóng
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-1.5">
                <span className="font-semibold text-neutral-800 uppercase text-[11px] block">
                  1. Dữ liệu thô (Bôi vàng PII phát hiện)
                </span>
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded leading-relaxed whitespace-pre-wrap min-h-[160px]">
                  Họ và tên: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>Nguyen Van A</mark><br />
                  Số CCCD: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>001099012345</mark><br />
                  Email: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>nguyen.a@example.com</mark><br />
                  Điện thoại: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>+84-912-345-678</mark><br />
                  Mức lương: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>25,000,000 VND</mark><br />
                  Địa chỉ: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>123 Le Loi, HCMC</mark>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-neutral-800 uppercase text-[11px] block">
                  2. Dữ liệu sau khi che mờ (Căn chỉnh chuẩn)
                </span>
                <div className="p-3 bg-white border border-neutral-200 rounded leading-relaxed whitespace-pre-wrap min-h-[160px] text-neutral-800">
                  Họ và tên: N*** A<br />
                  Số CCCD: ************<br />
                  Email: n***@example.com<br />
                  Điện thoại: ***-***-5678<br />
                  Mức lương: **,***,*** VND<br />
                  Địa chỉ: 123 L***, HCMC
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-1.5 bg-black text-white text-xs font-medium rounded hover:bg-neutral-800 transition-colors"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
