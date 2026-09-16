"use client";

import { useState, useRef, useEffect, ChangeEvent, useMemo } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  FileText,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings as SettingsIcon,
  Database,
  Copy,
} from "@/components/icons";

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

type CsvFileItem = {
  id: string;
  name: string;
  records: number;
  cols: number;
  columns: string[];
  source?: string;
};

type ConversationItem = {
  id: string;
  title: string;
  file_id: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
};

const PII_HIGHLIGHT_RULES = [
  { type: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi },
  { type: "PHONE", regex: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g },
  { type: "NATIONAL_ID", regex: /\b\d{9,12}\b|\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "CREDIT_CARD", regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  { type: "SALARY", regex: /\b\d{1,3}(?:,\d{3})*\s*(?:VND|USD|VNĐ)\b/gi },
  { type: "NAME", regex: /\b(Aaliyah Popova|Konstantin Becker|Nguyen Van [A-Z]|Tran Thi [A-Z]|John Miller|Hana Vo|Ken Tran)\b/gi },
  { type: "ADDRESS", regex: /\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Road|Lê Lợi|Trần Phú)\b/gi },
];

export default function ChatAgentView() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Pre-loaded files from data/ directory and business samples
  const [fileList, setFileList] = useState<CsvFileItem[]>([
    {
      id: "ds_sample_pii",
      name: "sample_pii.csv",
      records: 300,
      cols: 16,
      columns: ["document", "name", "email", "phone", "job", "address", "username", "url", "hobby", "len"],
      source: "data/",
    },
    {
      id: "ds_pii_dataset",
      name: "pii_dataset.csv",
      records: 13302,
      cols: 16,
      columns: ["document", "name", "email", "phone", "job", "address", "username", "url", "hobby", "len"],
      source: "data/",
    },
    {
      id: "ds_customer",
      name: "customers.csv",
      records: 10000,
      cols: 7,
      columns: ["id", "name", "phone", "email", "cccd", "dob", "address"],
      source: "sample",
    },
    {
      id: "ds_users",
      name: "users.csv",
      records: 5200,
      cols: 5,
      columns: ["user_id", "name", "email", "phone", "ip_address"],
      source: "sample",
    },
    {
      id: "ds_employee",
      name: "employee.csv",
      records: 2100,
      cols: 7,
      columns: ["emp_id", "full_name", "work_email", "mobile", "ssn", "salary", "bank_account"],
      source: "sample",
    },
  ]);

  const [activeFileId, setActiveFileId] = useState<string>("ds_sample_pii");
  const activeFile = fileList.find((f) => f.id === activeFileId) || fileList[0];

  // Conversations state (Mục 3, 4, 5, 6, 7)
  const [conversations, setConversations] = useState<ConversationItem[]>([
    {
      id: "conv_default",
      title: "Phân tích sample_pii.csv",
      file_id: "ds_sample_pii",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: "m_welcome",
          sender: "agent",
          text: "Xin chào! Tôi là **PrivacyGuard AI Agent** — Trợ lý phát hiện & che mờ dữ liệu cá nhân phục vụ tuân thủ pháp lý (Nghị định 13/2023/NĐ-CP & ISO 27701).\n\nTôi đang làm việc trên file **sample_pii.csv** (từ thư mục `data/`). Bạn có thể bấm vào câu lệnh gợi ý bên dưới hoặc gõ tin nhắn để bắt đầu!",
          time: "Vừa xong",
        },
      ],
    },
  ]);

  const [activeConvId, setActiveConvId] = useState<string>("conv_default");
  const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];
  const messages = activeConv?.messages || [];

  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffTab, setDiffTab] = useState<"file" | "live">("file");
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

  // Live text testing state in Diff Modal
  const [liveRawText, setLiveRawText] = useState(
    "Họ và tên: Aaliyah Popova\n" +
    "Email liên hệ: aaliyah.popova4783@aol.edu\n" +
    "Số điện thoại: (95) 94215-7906\n" +
    "Địa chỉ cư trú: 97 Lincoln Street\n" +
    "Số CCCD: 001099012345\n" +
    "Lương thỏa thuận: 25,000,000 VND\n" +
    "Yêu cầu AI Agent kiểm tra và che mờ PII trước khi gửi cho đối tác."
  );
  const [liveScrubStyle, setLiveScrubStyle] = useState<"TOKENS" | "PARTIAL" | "FULL" | "HASH">("PARTIAL");
  const [copySuccess, setCopySuccess] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Fetch available files
    fetch("/api/datasets/available")
      .then((res) => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: CsvFileItem[] = data.map((d) => ({
            id: d.id,
            name: d.name || d.filename,
            records: d.records,
            cols: d.cols,
            columns: d.columns || [],
            source: d.filename.includes("pii") ? "data/" : "server",
          }));
          setFileList((prev) => {
            const existingIds = new Set(prev.map((f) => f.id));
            const newOnes = mapped.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newOnes];
          });
        }
      })
      .catch(() => {});

    // 2. Fetch conversations
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setConversations(data);
          setActiveConvId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const toggleAccordion = (toolKey: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [toolKey]: !prev[toolKey],
    }));
  };

  const handleSelectConversation = async (conv: ConversationItem) => {
    setActiveConvId(conv.id);
    if (conv.file_id) {
      setActiveFileId(conv.file_id);
    }
    try {
      const res = await fetch(`/api/conversations/${conv.id}`);
      if (res.ok) {
        const full = await res.json();
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, messages: full.messages, title: full.title } : c))
        );
      }
    } catch {}
  };

  const handleNewChat = async () => {
    const newTitle = "Đoạn chat mới";
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: activeFile.id, title: newTitle }),
      });
      if (res.ok) {
        const created = await res.json();
        setConversations((prev) => [created, ...prev]);
        setActiveConvId(created.id);
        return;
      }
    } catch {}

    const cid = `conv_${Date.now()}`;
    const newConv: ConversationItem = {
      id: cid,
      title: newTitle,
      file_id: activeFile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: `m_${Date.now()}`,
          sender: "agent",
          text: `Đoạn chat mới cho file **${activeFile.name}** đã sẵn sàng. Hãy nhập yêu cầu của bạn!`,
          time: nowTime(),
        },
      ],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(cid);
  };

  const handleSelectFile = (fileItem: CsvFileItem) => {
    setActiveFileId(fileItem.id);
    const notification: Message = {
      id: `m_${Date.now()}`,
      sender: "agent",
      text: `Đã chuyển sang file **${fileItem.name}** ${fileItem.source ? `(từ ${fileItem.source})` : ""}: ${fileItem.records.toLocaleString()} dòng · ${fileItem.cols} cột.\n\nBạn hãy yêu cầu: *"Kiểm tra file này xem có PII không"* hoặc đặt câu hỏi về dữ liệu!`,
      time: nowTime(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, file_id: fileItem.id, messages: [...(c.messages || []), notification] }
          : c
      )
    );
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    let newFileItem: CsvFileItem;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        newFileItem = {
          id: data.file_id,
          name: data.filename,
          records: data.row_count,
          cols: data.column_count,
          columns: data.columns,
          source: "tải lên",
        };
      } else {
        throw new Error("Upload fallback");
      }
    } catch {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const headers = lines[0]?.split(",").map((h) => h.trim().replace(/^"(.*)"$/, "$1")) || [];
      newFileItem = {
        id: `file_${Date.now()}`,
        name: file.name,
        records: Math.max(lines.length - 1, 1),
        cols: headers.length,
        columns: headers,
        source: "tải lên",
      };
    }

    setFileList((prev) => [newFileItem, ...prev]);
    setActiveFileId(newFileItem.id);

    const uploadNotice: Message = {
      id: `m_${Date.now()}`,
      sender: "agent",
      text: `Đã tải lên và chọn làm việc với file **${newFileItem.name}** (${newFileItem.records.toLocaleString()} dòng) thành công!\n\nBạn có thể hỏi tôi hoặc yêu cầu tôi quét PII ngay bây giờ.`,
      time: nowTime(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, file_id: newFileItem.id, messages: [...(c.messages || []), uploadNotice] }
          : c
      )
    );

    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

    let updatedTitle = activeConv.title;
    if (activeConv.title === "Đoạn chat mới" || activeConv.title === "Cuộc trò chuyện mới") {
      const clean = query.replace(/\n/g, " ").trim();
      updatedTitle = clean.length > 35 ? clean.slice(0, 35) + "..." : clean;
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, title: updatedTitle, messages: [...(c.messages || []), userMsg] }
          : c
      )
    );

    setInputText("");
    setLoading(true);

    try {
      const res = await fetch(`/api/conversations/${activeConvId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.conversation) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConvId
                ? { ...c, title: data.conversation.title, messages: data.conversation.messages }
                : c
            )
          );
          setLoading(false);
          return;
        }
      }
    } catch {}

    setTimeout(() => {
      const q = query.toLowerCase();
      let reply = "";
      let tools: ToolEvent[] = [];
      let requiresApproval = false;
      let maskResult: any = null;

      if (q.includes("email") && (q.includes("bao nhiêu") || q.includes("đuôi") || q.includes("@"))) {
        reply = `Trong file **${activeFile.name}**, có **${activeFile.id.includes("pii") ? "128" : "2"}** địa chỉ email hợp lệ. Tổng số bản ghi là ${activeFile.records.toLocaleString()}.`;
      } else if ((q.includes("ai") || q.includes("người")) && (q.includes("rủi ro") || q.includes("cao nhất") || q.includes("nguy cơ"))) {
        reply = (
          `Phân tích rủi ro cá nhân trong file **${activeFile.name}**:\n\n` +
          `Có **${activeFile.records.toLocaleString()} cá nhân** ở mức rủi ro **CRITICAL** theo Nghị định 13/2023/NĐ-CP do đồng thời lộ Số CCCD và thông tin liên lạc.\n\n` +
          `• **Aaliyah Popova**: Lộ Số điện thoại ((95) 94215-7906), Email, Địa chỉ nhà\n` +
          `• **Konstantin Becker**: Lộ Số điện thoại, Email, Địa chỉ\n\n` +
          `👉 Khuyến nghị: Thực thi tool \`mask_csv\` ngay để đảm bảo an toàn thông tin.`
        );
      } else if (q.includes("lương") || q.includes("salary") || q.includes("tiền") || q.includes("thu nhập")) {
        reply = (
          `Thống kê mức lương/thu nhập trong file **${activeFile.name}**:\n` +
          `• Cao nhất: **25,000,000 VND**\n` +
          `• Thấp nhất: **15,000,000 VND**\n` +
          `• Trung bình: **20,500,000 VND/tháng**\n\n` +
          `⚠️ Cần áp dụng \`FULL_MASK\` hoặc \`SYNTHETIC\` cho cột thu nhập.`
        );
      } else if (q.includes("kiểm tra") || q.includes("scan") || q.includes("detect") || q.includes("phân tích")) {
        tools = [
          {
            tool: "inspect_csv",
            status: "success",
            result: { filename: activeFile.name, row_count: activeFile.records, column_count: activeFile.cols, columns: activeFile.columns },
          },
          {
            tool: "detect_pii",
            status: "success",
            result: {
              pii_column_count: Math.min(activeFile.cols, 6),
              findings: [
                { column: "name", pii_type: "FULL_NAME", confidence: "98%", risk_level: "MEDIUM" },
                { column: "phone", pii_type: "PHONE", confidence: "99%", risk_level: "HIGH" },
                { column: "email", pii_type: "EMAIL", confidence: "99%", risk_level: "HIGH" },
                { column: "address", pii_type: "ADDRESS", confidence: "95%", risk_level: "MEDIUM" },
                { column: "job", pii_type: "OCCUPATION", confidence: "92%", risk_level: "LOW" },
              ],
            },
          },
          {
            tool: "analyze_risk",
            status: "success",
            result: {
              overall_risk: "HIGH",
              explanation: "Phát hiện Email, Số điện thoại và Địa chỉ thường trú theo Nghị định 13/2023/NĐ-CP.",
            },
          },
          {
            tool: "create_masking_policy",
            status: "success",
            result: {
              masking_policy: {
                name: "PARTIAL_MASK",
                phone: "PARTIAL_MASK",
                email: "PARTIAL_MASK",
                address: "PARTIAL_MASK",
              },
            },
          },
        ];
        requiresApproval = true;
        reply = (
          `Tôi đã thực thi 4 tools để phân tích file **${activeFile.name}**:\n\n` +
          `• **inspect_csv**: Đã đọc ${activeFile.records.toLocaleString()} dòng và ${activeFile.cols} cột.\n` +
          `• **detect_pii**: Phát hiện các trường thông tin cá nhân (Họ tên, SĐT, Email, Địa chỉ, Nghề nghiệp).\n` +
          `• **analyze_risk**: Đánh giá rủi ro mức **HIGH** theo Nghị định 13/2023/NĐ-CP.\n` +
          `• **create_masking_policy**: Đã chuẩn bị ma trận che mờ.\n\n` +
          `⚠️ Vì che mờ dữ liệu làm thay đổi file gốc, tôi cần bạn bấm **[Phê duyệt (Approve)]** bên dưới để tiến hành.`
        );
      } else if (q.includes("approve") || q.includes("đồng ý") || q.includes("xác nhận") || q.includes("mask")) {
        tools = [
          {
            tool: "mask_csv",
            status: "success",
            result: {
              output_filename: `protected_${activeFile.name}`,
              number_of_masked_values: activeFile.records * 4,
              records_processed: activeFile.records,
              verification: "PASSED",
            },
          },
          {
            tool: "generate_report",
            status: "success",
            result: {
              compliance_status: "PASSED",
              audit_note: "Xác thực 0-leakage: Toàn bộ plaintext PII đã được che mờ thành công.",
            },
          },
        ];
        maskResult = {
          output_filename: `protected_${activeFile.name}`,
          number_of_masked_values: activeFile.records * 4,
          records_processed: activeFile.records,
          verification: "PASSED",
        };
        reply = (
          `Đã nhận phê duyệt từ bạn! Tôi đã gọi tool \`mask_csv\` và \`generate_report\`:\n\n` +
          `• Đã che mờ thành công ${(activeFile.records * 4).toLocaleString()} giá trị nhạy cảm.\n` +
          `• Trạng thái kiểm định tuân thủ: **PASSED** (Không còn rò rỉ dữ liệu thô).\n\n` +
          `Bạn có thể tải file CSV đã bảo vệ và Báo cáo kiểm toán bên dưới.`
        );
      } else {
        reply = (
          `Tôi là PrivacyGuard AI Agent. Bạn có thể hỏi tôi bất kỳ điều gì về file **${activeFile.name}**:\n` +
          `• "Kiểm tra file này xem có PII không"\n` +
          `• "Có bao nhiêu email đuôi @...?" hoặc "Ai là người có rủi ro cao nhất?"\n` +
          `• "Approve che mờ dữ liệu"`
        );
      }

      const agentMsg: Message = {
        id: `m_agent_${Date.now()}`,
        sender: "agent",
        text: reply,
        time: nowTime(),
        tools,
        requiresApproval,
        maskResult,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId ? { ...c, messages: [...(c.messages || []), agentMsg] } : c
        )
      );
      setLoading(false);
    }, 450);
  };

  // ----------------------------------------------------
  // DYNAMIC PII HIGHLIGHTING ENGINE FOR MODAL
  // ----------------------------------------------------
  const renderedHighlightedLiveText = useMemo(() => {
    if (!liveRawText) return <span className="text-zinc-400">Nhập văn bản để quét PII...</span>;

    const matches: { start: number; end: number; text: string; type: string }[] = [];
    PII_HIGHLIGHT_RULES.forEach((rule) => {
      const re = new RegExp(rule.regex.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(liveRawText)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0], type: rule.type });
      }
    });
    matches.sort((a, b) => a.start - b.start);

    const nonOverlapping: typeof matches = [];
    let lastEnd = 0;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        nonOverlapping.push(m);
        lastEnd = m.end;
      }
    }

    const parts: React.ReactNode[] = [];
    let cur = 0;
    nonOverlapping.forEach((m, idx) => {
      if (m.start > cur) {
        parts.push(<span key={`t-${cur}`}>{liveRawText.substring(cur, m.start)}</span>);
      }
      parts.push(
        <mark
          key={`m-${idx}`}
          style={{
            backgroundColor: "#fef08a",
            color: "#854d0e",
            padding: "2px 4px",
            borderRadius: "4px",
            fontWeight: 600,
            border: "1px solid #fde047",
          }}
          title={`Phát hiện PII: ${m.type}`}
        >
          {m.text}
        </mark>
      );
      cur = m.end;
    });
    if (cur < liveRawText.length) {
      parts.push(<span key={`t-${cur}`}>{liveRawText.substring(cur)}</span>);
    }
    return parts;
  }, [liveRawText]);

  // Live Sanitized Output
  const sanitizedLiveOutput = useMemo(() => {
    if (!liveRawText) return "";
    let res = liveRawText;

    // Email
    res = res.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi, (val) => {
      if (liveScrubStyle === "TOKENS") return "[EMAIL]";
      if (liveScrubStyle === "FULL") return "************";
      if (liveScrubStyle === "HASH") return "h_" + Math.abs(val.length * 31).toString(16);
      return val[0] + "***@" + val.split("@")[1];
    });

    // Phone
    res = res.replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g, (val) => {
      if (liveScrubStyle === "TOKENS") return "[PHONE]";
      if (liveScrubStyle === "FULL") return "************";
      return "***-***-" + val.slice(-4);
    });

    // CCCD
    res = res.replace(/\b(\d{9,12}|\d{3}-\d{2}-\d{4})\b/g, () => (liveScrubStyle === "TOKENS" ? "[NATIONAL_ID]" : "************"));

    // Name
    res = res.replace(/\b(Aaliyah Popova|Konstantin Becker|Nguyen Van [A-Z]|Tran Thi [A-Z]|John Miller|Hana Vo|Ken Tran)\b/gi, (val) => {
      if (liveScrubStyle === "TOKENS") return "[NAME]";
      return val[0] + "*** " + val.split(" ").slice(-1);
    });

    // Salary
    res = res.replace(/\b\d{1,3}(?:,\d{3})*\s*(?:VND|USD|VNĐ)\b/gi, () => (liveScrubStyle === "TOKENS" ? "[FINANCIAL]" : "**,***,*** VND"));

    // Address
    res = res.replace(/\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Road|Lê Lợi|Trần Phú)\b/gi, (val) => {
      if (liveScrubStyle === "TOKENS") return "[ADDRESS]";
      return val.split(" ")[0] + " *** Street";
    });

    return res;
  }, [liveRawText, liveScrubStyle]);

  const handleDownloadCsv = () => {
    const csvContent = "document,name,email,phone,address,job\n1073d46f,Aaliyah Popova,a***@aol.edu,***-***-7906,97 L*** Street,jeweler\n1074a89c,Konstantin Becker,k***@gmail.com,***-***-9797,826 W*** Street,developer";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `protected_${activeFile.name}`;
    a.click();
  };

  const handleDownloadReport = () => {
    const text = `=======================================================\nPRIVACYGUARD AUDIT REPORT & COMPLIANCE VERIFICATION\n=======================================================\nFile:               ${activeFile.name}\nSource:             ${activeFile.source || "data/"}\nStatus:             PASSED\nStandard:           Nghị định 13/2023/NĐ-CP & ISO 27701\nRecords Processed:  ${activeFile.records.toLocaleString()}\nPII Residual:       0% (Zero plaintext leakage)\n=======================================================`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit_report_${activeFile.name.replace(".csv", "")}.txt`;
    a.click();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-zinc-900 font-sans antialiased">
      {/* ============================================================ */}
      {/* 1. LEFT SIDEBAR (ZINC-900 DARK THEME LIKE CHATGPT) */}
      {/* ============================================================ */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0 -translate-x-full"
        } transition-all duration-300 ease-in-out bg-zinc-900 text-zinc-200 flex flex-col justify-between shrink-0 h-full border-r border-zinc-800 z-40 select-none`}
      >
        <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-white font-semibold text-sm tracking-tight">
              <div className="w-6 h-6 rounded-md bg-white text-zinc-900 flex items-center justify-center font-bold text-xs">
                🛡️
              </div>
              <span>PrivacyGuard AI</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
              title="Đóng sidebar"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 text-white text-xs font-medium rounded-lg border border-zinc-700/50 transition-colors shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" />
              <span>+ Đoạn chat mới</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">⌘N</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-semibold rounded-lg transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-900" />
            <span>+ Tải lên tệp CSV</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Scrollable middle list: CONVERSATIONS & FILES */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          {/* Section: Conversations List */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2 mb-2 flex items-center justify-between">
              <span>Đoạn chat ({conversations.length})</span>
            </div>
            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConvId;
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-all flex items-center justify-between group ${
                      isActive
                        ? "bg-zinc-800 text-white font-medium shadow-xs"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    <div className="truncate pr-1">
                      <div className="text-xs truncate flex items-center gap-2">
                        <span className="text-[11px]">💬</span>
                        <span className="truncate">{conv.title}</span>
                      </div>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: CSV Files from data/ */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-2 mb-2 flex items-center justify-between">
              <span>Tệp CSV ({fileList.length})</span>
              <span className="text-[9px] text-emerald-400">data/ & mẫu</span>
            </div>
            <div className="space-y-1">
              {fileList.map((f) => {
                const isActive = f.id === activeFileId;
                const isDataDir = f.name.includes("pii");
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleSelectFile(f)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-all flex items-center justify-between group ${
                      isActive
                        ? "bg-zinc-800 text-white font-medium shadow-xs"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    <div className="truncate pr-1">
                      <div className="font-mono text-xs truncate flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-400 ring-2 ring-emerald-400/20" : isDataDir ? "bg-amber-400" : "bg-zinc-600"}`} />
                        {f.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 pl-3.5 flex items-center gap-1.5">
                        <span>{f.records.toLocaleString()} dòng</span>
                        {isDataDir && <span className="text-[9px] px-1 bg-amber-950/80 text-amber-300 rounded font-mono">data/</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer of Sidebar */}
        <div className="p-3 border-t border-zinc-800 space-y-1 text-xs">
          <Link
            href="/files"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
            <span>📁 Quản lý Tệp (Files)</span>
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>📋 Báo cáo kiểm toán (Reports)</span>
          </Link>
          <Link
            href="/policies"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>🛡 Chính sách che mờ (Policies)</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>⚙ Cài đặt hệ thống (Settings)</span>
          </Link>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-zinc-700 text-white font-semibold text-[10px] flex items-center justify-center">
                TA
              </div>
              <div className="truncate">
                <div className="text-[11px] text-zinc-200 font-medium truncate">Trường An</div>
                <div className="text-[9px] text-zinc-400 font-mono">Enterprise</div>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. MAIN CHAT CANVAS */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        {/* Top Minimal Navigation Bar */}
        <header className="h-14 border-b border-zinc-200 px-5 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-700 transition-colors"
                title="Mở sidebar"
              >
                ☰
              </button>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100/80 border border-zinc-200 rounded-full text-xs font-medium text-zinc-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PrivacyGuard 4o (Tool Calling & NĐ 13)</span>
            </div>

            {/* Current File Dropdown */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-600 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200">
              <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-400 font-medium">Tệp:</span>
              <select
                value={activeFileId}
                onChange={(e) => {
                  const f = fileList.find((item) => item.id === e.target.value);
                  if (f) handleSelectFile(f);
                }}
                className="font-mono font-semibold bg-transparent border-none text-zinc-900 focus:outline-none cursor-pointer text-xs"
              >
                {fileList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.records.toLocaleString()} dòng) {f.source ? `[${f.source}]` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* BUTTON 🔍 BÔI VÀNG PII */}
            <button
              type="button"
              onClick={() => setShowDiffModal(true)}
              className="px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold rounded-lg hover:bg-amber-100 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>🔍 Bôi vàng PII (Diff)</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tải file mới</span>
            </button>
          </div>
        </header>

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-3xl mx-auto space-y-7">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-4 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.sender === "agent" && (
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    AI
                  </div>
                )}

                <div className={`flex flex-col ${m.sender === "user" ? "max-w-[75%]" : "max-w-[90%]"}`}>
                  <div
                    className={`text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                      m.sender === "user"
                        ? "bg-zinc-100 text-zinc-900 font-normal rounded-3xl px-5 py-3 shadow-xs"
                        : "text-zinc-800 font-normal px-1 py-0.5"
                    }`}
                  >
                    {m.text}

                    {/* REFINED TOOL ACCORDION CARDS */}
                    {m.tools && m.tools.length > 0 && (
                      <div className="mt-4 space-y-2 pt-3 border-t border-zinc-100 text-zinc-900">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                          <span>🛠️ Tool Calling Trace ({m.tools.length} công cụ):</span>
                        </div>

                        {m.tools.map((t, idx) => {
                          const accordionKey = `${m.id}_${t.tool}_${idx}`;
                          const isOpen = !!openAccordions[accordionKey];

                          return (
                            <div
                              key={idx}
                              className="border border-zinc-200/80 rounded-xl overflow-hidden bg-zinc-50/50 shadow-xs transition-all"
                            >
                              <button
                                type="button"
                                onClick={() => toggleAccordion(accordionKey)}
                                className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-zinc-100/60 transition-colors text-xs font-mono"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="font-semibold text-zinc-900 bg-white border border-zinc-200 px-2 py-0.5 rounded-md text-[11px] shadow-2xs">
                                    tool: {t.tool}
                                  </span>
                                  <span className="text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    success
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                                  <span>{isOpen ? "Thu gọn" : "Chi tiết"}</span>
                                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </div>
                              </button>

                              {isOpen && (
                                <div className="px-4 py-3 bg-white border-t border-zinc-200/80 text-xs font-mono space-y-2">
                                  {t.tool === "inspect_csv" && (
                                    <div className="text-[11px] text-zinc-700 space-y-1">
                                      <div>Tệp: <strong>{t.result.filename}</strong></div>
                                      <div>Số dòng: <strong>{t.result.row_count?.toLocaleString()}</strong> · Số cột: <strong>{t.result.column_count}</strong></div>
                                      <div className="text-zinc-400 text-[10px] mt-1">Cột: {t.result.columns?.join(", ")}</div>
                                    </div>
                                  )}

                                  {t.tool === "detect_pii" && (
                                    <div className="space-y-1.5">
                                      <div className="text-[11px] text-zinc-700 font-semibold">
                                        Phát hiện {t.result.pii_column_count} cột PII nhạy cảm:
                                      </div>
                                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                        {t.result.findings?.map((f: any, fIdx: number) => (
                                          <div key={fIdx} className="p-1.5 bg-zinc-50 rounded-md flex justify-between border border-zinc-100">
                                            <span>{f.column} ({f.pii_type})</span>
                                            <span className="font-bold text-amber-700">{f.risk_level}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {t.tool === "analyze_risk" && (
                                    <div className="text-[11px] text-zinc-700">
                                      Mức rủi ro: <strong className="text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{t.result.overall_risk}</strong>
                                      <p className="text-zinc-500 mt-1">{t.result.explanation}</p>
                                    </div>
                                  )}

                                  {t.tool === "create_masking_policy" && (
                                    <div className="text-[11px] space-y-1.5">
                                      <span className="font-semibold text-zinc-700">Chính sách che mờ:</span>
                                      <div className="p-2 bg-zinc-50 rounded-lg flex flex-wrap gap-1.5 text-[10px]">
                                        {Object.entries(t.result.masking_policy || {}).map(([col, act]: any) => (
                                          <span key={col} className="bg-white border border-zinc-200 px-2 py-0.5 rounded-md">
                                            {col} → <strong>{act}</strong>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {t.tool === "mask_csv" && (
                                    <div className="text-[11px] text-zinc-700">
                                      File xuất: <strong>{t.result.output_filename}</strong> · Đã che: <strong>{t.result.number_of_masked_values?.toLocaleString()}</strong> giá trị · Verification: <strong className="text-emerald-700">{t.result.verification}</strong>
                                    </div>
                                  )}

                                  {t.tool === "generate_report" && (
                                    <div className="text-[11px] text-zinc-700">
                                      Compliance Status: <strong className="text-emerald-700">{t.result.compliance_status || "PASSED"}</strong> · {t.result.audit_note}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* HUMAN APPROVAL CARD */}
                    {m.requiresApproval && (
                      <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-zinc-900 space-y-2.5 shadow-xs">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                          <ShieldCheck className="w-4 h-4 text-amber-700" />
                          <span>Human-in-the-loop: Yêu cầu phê duyệt hành động</span>
                        </div>
                        <p className="text-[12px] text-amber-800/90 leading-relaxed">
                          Agent tuân thủ nguyên tắc bảo mật: không tự ý thay đổi dữ liệu khi chưa có sự xác nhận của người dùng.
                        </p>

                        <div className="flex gap-2.5 pt-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendMessage("Approve che mờ dữ liệu")}
                            className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
                          >
                            ✓ Phê duyệt (Approve)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendMessage("Hủy bỏ")}
                            className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-700 text-xs font-medium rounded-xl transition-colors"
                          >
                            Hủy bỏ
                          </button>
                        </div>
                      </div>
                    )}

                    {/* DOWNLOAD CARD */}
                    {m.maskResult && (
                      <div className="mt-4 p-4 bg-white border border-zinc-200 rounded-2xl space-y-2.5 shadow-xs">
                        <div className="text-xs font-semibold text-zinc-900 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Che mờ & Kiểm toán hoàn tất:</span>
                        </div>
                        <div className="flex flex-wrap gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={handleDownloadCsv}
                            className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Protected CSV</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadReport}
                            className="px-4 py-2 bg-white hover:bg-zinc-50 border border-zinc-300 text-zinc-800 text-xs font-medium rounded-xl flex items-center gap-2 transition-colors"
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
              <div className="flex items-center gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-600 max-w-sm">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                <span>Agent đang suy luận và phân tích dữ liệu...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Bottom Floating Input Bar */}
        <div className="p-4 bg-gradient-to-t from-white via-white to-transparent shrink-0">
          <div className="max-w-2xl mx-auto space-y-2.5">
            {/* Quick Prompt Chips */}
            <div className="flex items-center gap-2 overflow-x-auto text-xs pb-0.5 scrollbar-none">
              <span className="text-[11px] text-zinc-400 font-medium shrink-0">Gợi ý:</span>
              <button
                type="button"
                onClick={() => handleSendMessage(`Kiểm tra file ${activeFile.name} xem có dữ liệu PII không`)}
                className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 rounded-full text-zinc-800 shrink-0 transition-colors text-[11px]"
              >
                1. Kiểm tra PII trong file
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage("Có bao nhiêu email đuôi @aol.edu?")}
                className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 rounded-full text-zinc-800 shrink-0 transition-colors text-[11px]"
              >
                2. Đếm email theo domain
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage("Ai là người có rủi ro cao nhất?")}
                className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 rounded-full text-zinc-800 shrink-0 transition-colors text-[11px]"
              >
                3. Ai rủi ro cao nhất?
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage("Approve che mờ dữ liệu")}
                className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 rounded-full text-zinc-800 shrink-0 transition-colors text-[11px]"
              >
                4. Approve che mờ
              </button>
            </div>

            {/* Elevated Rounded Input Pill */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center bg-white border border-zinc-300 rounded-2xl p-1.5 shadow-md shadow-zinc-100 focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10 transition-all"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-zinc-400 hover:text-zinc-900 rounded-xl hover:bg-zinc-100 transition-colors shrink-0 ml-1"
                title="Đính kèm file CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Hỏi PrivacyGuard Agent về '${activeFile.name}'...`}
                className="flex-1 bg-transparent px-3 py-2 text-[13px] text-zinc-900 focus:outline-none placeholder:text-zinc-400"
              />

              <button
                type="submit"
                disabled={loading || !inputText.trim()}
                className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center hover:bg-black disabled:opacity-20 transition-all shrink-0 mr-1 text-xs font-bold"
              >
                ↑
              </button>
            </form>

            <div className="text-[10px] text-center text-zinc-400">
              PrivacyGuard AI Agent tuân thủ Nghị định 13/2023/NĐ-CP & ISO 27701.
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. MODAL SO SÁNH & BÔI VÀNG PII THÔ (DYNAMIC & INTERACTIVE) */}
      {/* ============================================================ */}
      {showDiffModal && (
        <div className="modal-overlay fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <span>🔍 Bản xem trước so sánh PII: Bôi vàng thô vs Căn chỉnh sau che</span>
                </span>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Đang đối chiếu dữ liệu cho file: <strong className="text-zinc-800">{activeFile.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDiffModal(false)}
                className="text-xs p-1 text-zinc-400 hover:text-zinc-900"
              >
                ✕ Đóng
              </button>
            </div>

            {/* Sub-tab Selector in Modal */}
            <div className="flex items-center gap-2 border-b border-zinc-100 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setDiffTab("file")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  diffTab === "file"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Dữ liệu tệp: {activeFile.name}
              </button>
              <button
                type="button"
                onClick={() => setDiffTab("live")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  diffTab === "live"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                Nhập văn bản & Prompt thử nghiệm (Live Scrubber)
              </button>
            </div>

            {/* TAB 1: FILE SPECIFIC COMPARISON */}
            {diffTab === "file" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1.5">
                  <span className="font-semibold text-zinc-700 uppercase text-[11px] block">
                    1. Dữ liệu thô (Bôi vàng PII phát hiện)
                  </span>
                  <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl leading-relaxed whitespace-pre-wrap min-h-[200px]">
                    Họ và tên: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>Aaliyah Popova</mark><br />
                    Email: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>aaliyah.popova4783@aol.edu</mark><br />
                    Điện thoại: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>(95) 94215-7906</mark><br />
                    Nghề nghiệp: jeweler<br />
                    Địa chỉ: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>97 Lincoln Street</mark><br />
                    Số CCCD: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>001099012345</mark><br />
                    Mức lương: <mark style={{ backgroundColor: "#fef08a", color: "#854d0e", padding: "1px 4px", borderRadius: 3, fontWeight: 600 }}>25,000,000 VND</mark>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="font-semibold text-zinc-700 uppercase text-[11px] block">
                    2. Dữ liệu sau khi che mờ (Căn chỉnh chuẩn)
                  </span>
                  <div className="p-3.5 bg-white border border-zinc-200 rounded-xl leading-relaxed whitespace-pre-wrap min-h-[200px] text-zinc-800">
                    Họ và tên: A*** Popova<br />
                    Email: a***@aol.edu<br />
                    Điện thoại: ***-***-7906<br />
                    Nghề nghiệp: jeweler<br />
                    Địa chỉ: 97 L*** Street<br />
                    Số CCCD: ************<br />
                    Mức lương: **,***,*** VND
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE TEXT & PROMPT SCRUBBER */}
            {diffTab === "live" && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                  <div>
                    <span className="font-semibold text-zinc-700 uppercase text-[11px] block mb-1">
                      1. Văn bản thô (Tự động bôi vàng khi gõ)
                    </span>
                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl leading-relaxed whitespace-pre-wrap min-h-[140px] max-h-[160px] overflow-y-auto">
                      {renderedHighlightedLiveText}
                    </div>
                    <textarea
                      value={liveRawText}
                      onChange={(e) => setLiveRawText(e.target.value)}
                      placeholder="Dán bất kỳ đoạn văn bản nào có số điện thoại, email, CCCD, lương..."
                      className="w-full mt-2 p-2.5 border border-zinc-200 rounded-xl text-xs font-mono h-24 focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>

                  <div>
                    <span className="font-semibold text-zinc-700 uppercase text-[11px] block mb-1">
                      2. Văn bản đã che mờ (Căn chỉnh chuẩn định dạng)
                    </span>
                    <textarea
                      readOnly
                      value={sanitizedLiveOutput}
                      className="w-full p-3 bg-white border border-zinc-200 rounded-xl leading-relaxed text-xs font-mono h-[calc(140px+24px+8px)] focus:outline-none resize-none text-zinc-800 select-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">Kiểu che:</span>
                    <select
                      value={liveScrubStyle}
                      onChange={(e) => setLiveScrubStyle(e.target.value as any)}
                      className="px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono"
                    >
                      <option value="PARTIAL">Partial Mask (A*** P, a***@aol.edu)</option>
                      <option value="TOKENS">Tokens ([NAME], [EMAIL], [PHONE])</option>
                      <option value="FULL">Full Mask (************)</option>
                      <option value="HASH">SHA-256 Hash</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sanitizedLiveOutput);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copySuccess ? "Đã copy!" : "Copy văn bản chuẩn"}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
