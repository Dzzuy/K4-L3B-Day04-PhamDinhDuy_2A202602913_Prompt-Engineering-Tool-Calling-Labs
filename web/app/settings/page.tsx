"use client";

import { useEffect, useState } from "react";
import { Check, Shield } from "@/components/icons";
import { getStoredSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/data-store";
import type { AppSettings, RedactionAction } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(getStoredSettings());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Settings
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          Basic configuration for AI detection providers and default masking policies.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* AI Provider */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">
            AI Provider
          </label>
          <select
            value={settings.aiProvider}
            onChange={(e) =>
              setSettings({ ...settings, aiProvider: e.target.value })
            }
            className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            <option value="OpenRouter (Claude 3.5 Sonnet)">OpenRouter (Claude 3.5 Sonnet)</option>
            <option value="OpenAI (GPT-4o mini)">OpenAI (GPT-4o mini)</option>
            <option value="Anthropic (Claude 3.5 Sonnet)">Anthropic Direct API</option>
            <option value="Local Rule-based Engine">Local Rule-based Engine (Offline fallback)</option>
          </select>
        </div>

        {/* Model */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">
            Model
          </label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) =>
              setSettings({ ...settings, model: e.target.value })
            }
            className="w-full px-3 py-2 text-xs font-mono bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        {/* API Configuration Status */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">
            API Configuration Status
          </label>
          <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border border-neutral-200 rounded text-xs">
            <span className="font-mono text-neutral-800">{settings.apiStatus}</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
              Operational
            </span>
          </div>
        </div>

        {/* File Size Limit */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">
            File Size Limit
          </label>
          <input
            type="text"
            value={settings.fileSizeLimit}
            onChange={(e) =>
              setSettings({ ...settings, fileSizeLimit: e.target.value })
            }
            className="w-full px-3 py-2 text-xs font-mono bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        {/* Default Masking Policy */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-700">
            Default Masking Policy
          </label>
          <select
            value={settings.defaultPolicy}
            onChange={(e) =>
              setSettings({
                ...settings,
                defaultPolicy: e.target.value as RedactionAction,
              })
            }
            className="w-full px-3 py-2 text-xs font-mono bg-white border border-neutral-300 rounded text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            <option value="PARTIAL_MASK">PARTIAL_MASK (Recommended)</option>
            <option value="FULL_MASK">FULL_MASK (Redact everything)</option>
            <option value="HASH">HASH (Cryptographic SHA-256)</option>
            <option value="ANONYMIZE">ANONYMIZE (Synthetic pseudonym)</option>
            <option value="GENERALIZE">GENERALIZE (Coarsen data)</option>
            <option value="SUPPRESS">SUPPRESS (Clear column)</option>
          </select>
        </div>

        {/* Notification */}
        {saved && (
          <div className="p-3 bg-neutral-100 border border-neutral-300 rounded text-xs text-neutral-800 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-neutral-900" />
            <span>Settings saved successfully.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-medium rounded transition-colors"
          >
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
