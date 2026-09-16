"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "@/components/icons";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [model, setModel] = useState("OpenRouter (Claude 3.5 Sonnet)");
  const [streaming, setStreaming] = useState(true);
  const [retention, setRetention] = useState("30 ngày");
  const [auditLog, setAuditLog] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900 p-6 flex flex-col items-center">
      <div className="max-w-2xl w-full space-y-6">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium bg-white px-3 py-1.5 rounded-lg border border-zinc-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Chat</span>
          </Link>
          <span className="text-xs text-zinc-400 font-mono">PrivacyGuard / Settings</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">
            System appearance, AI Agent engine configuration, and privacy compliance.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Appearance Section */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Appearance</h3>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-800 block">Theme</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "light", label: "○ Light" },
                  { id: "dark", label: "○ Dark" },
                  { id: "system", label: "● System" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                      theme === t.id
                        ? "bg-zinc-900 text-white border-zinc-900 font-semibold"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Agent Section */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Agent</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 block">Model Engine</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="OpenRouter (Claude 3.5 Sonnet)">OpenRouter (Claude 3.5 Sonnet) · Khuyên dùng</option>
                <option value="Google Gemini 1.5 Flash">Google Gemini 1.5 Flash</option>
                <option value="OpenAI GPT-4o mini">OpenAI GPT-4o mini</option>
                <option value="Local Rule-based Engine">Local Rule-based Engine (Offline fallback)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <div>
                <span className="text-xs font-semibold text-zinc-800 block">Streaming Mode</span>
                <span className="text-[11px] text-zinc-400">Server-Sent Events (SSE) theo thời gian thực</span>
              </div>
              <input
                type="checkbox"
                checked={streaming}
                onChange={(e) => setStreaming(e.target.checked)}
                className="w-4 h-4 accent-black cursor-pointer"
              />
            </div>
          </div>

          {/* Privacy Section */}
          <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Privacy & Compliance</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 block">Data Retention</label>
              <select
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="7 ngày">7 ngày</option>
                <option value="30 ngày">30 ngày (Tiêu chuẩn Nghị định 13)</option>
                <option value="90 ngày">90 ngày</option>
                <option value="Xóa ngay khi kết thúc phiên">Xóa ngay khi kết thúc phiên</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <div>
                <span className="text-xs font-semibold text-zinc-800 block">Audit Logging</span>
                <span className="text-[11px] text-zinc-400">Lưu nhật ký kiểm toán không thể sửa đổi (SHA-256)</span>
              </div>
              <input
                type="checkbox"
                checked={auditLog}
                onChange={(e) => setAuditLog(e.target.checked)}
                className="w-4 h-4 accent-black cursor-pointer"
              />
            </div>
          </div>

          {/* Feedback & Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã lưu cài đặt thành công!</span>
                </span>
              )}
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
