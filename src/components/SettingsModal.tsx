import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AppSettings } from "../store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onBackup: () => Promise<boolean>;
  onExportTxt: () => Promise<boolean>;
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  storageUsage: string;
  handleRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImportTxt: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const txtExample = `\u6807\u9898: \u793a\u4f8b\u63d0\u793a\u8bcd
\u5206\u7c7b: \u901a\u7528
\u5feb\u6377\u952e: Alt+1
\u5185\u5bb9:
\u8fd9\u91cc\u586b\u5199\u63d0\u793a\u8bcd\u5185\u5bb9\uff0c\u53ef\u4ee5\u6362\u884c\u3002
---

\u6807\u9898: \u4ee3\u7801\u793a\u4f8b
\u5206\u7c7b: \u4ee3\u7801
\u5feb\u6377\u952e:
\u5185\u5bb9:
console.log("Hello SnapBar");`;

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  onBackup,
  onExportTxt,
  settings,
  setSettings,
  storageUsage,
  handleRestore,
  handleImportTxt,
}: SettingsModalProps) {
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  if (!isOpen) return null;

  const previewScale =
    typeof settings.buttonSize === "number"
      ? settings.buttonSize / 100
      : settings.buttonSize === "small"
        ? 0.85
        : settings.buttonSize === "large"
          ? 1.15
          : 1;

  const previewStyle = {
    fontSize: `${Math.max(10, 14 * previewScale)}px`,
    padding: `${Math.max(6, 8 * previewScale)}px ${Math.max(12, 16 * previewScale)}px`,
    minWidth: `${Math.max(92, 120 * previewScale)}px`,
  };

  const handleClose = async () => {
    onClose();
    await invoke("set_input_mode", { enable: false });
    await invoke("set_panel_expanded", { expanded: false });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-40px)] w-[90%] max-w-2xl overflow-hidden rounded-[22px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,252,0.98))] text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,244,248,0.92))] px-6 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-600/80">{"\u5de5\u4f5c\u533a\u8bbe\u7f6e"}</div>
          <h3 className="mt-1.5 text-lg font-semibold text-slate-900">{"\u8bbe\u7f6e"}</h3>
          <p className="mt-1 text-sm text-slate-500">{"\u8c03\u6574\u5916\u89c2\u3001\u5feb\u6377\u952e\u63d0\u793a\u663e\u793a\u53ca\u5bfc\u5165\u5bfc\u51fa\u9009\u9879\u3002"}</p>
        </div>

        <form onSubmit={onSave} className="max-h-[calc(100vh-150px)] space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-4">
            <section className="rounded-[20px] border border-slate-200 bg-slate-50/90 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{"\u5916\u89c2"}</div>
              <div className="mt-4">
                <label className="mb-2 block text-xs text-slate-600">
                  {"\u6309\u94ae\u5927\u5c0f\uff1a"}
                  {typeof settings.buttonSize === "number" ? `${settings.buttonSize}%` : settings.buttonSize}
                </label>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_180px]">
                  <div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      step="5"
                      value={typeof settings.buttonSize === "number" ? settings.buttonSize : 100}
                      onChange={(e) => setSettings({ ...settings, buttonSize: parseInt(e.target.value, 10) })}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-sky-500"
                    />
                    <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                      <span>{"\u5c0f"}</span>
                      <span>{"\u9ed8\u8ba4"}</span>
                      <span>{"\u5927"}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{"\u9884\u89c8"}</div>
                    <div className="mt-3 flex min-h-[72px] items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(226,232,240,0.8),rgba(241,245,249,0.95))]">
                      <button
                        type="button"
                        style={previewStyle}
                        className="rounded-xl border border-slate-300 bg-slate-900/90 font-medium text-white shadow-sm"
                      >
                        {"\u793a\u4f8b\u6309\u94ae"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{"\u663e\u793a\u4e0b\u65b9\u5feb\u6377\u952e\u63d0\u793a"}</div>
                    <div className="mt-1 text-xs text-slate-500">{"\u5173\u95ed\u540e\uff0c\u4e3b\u9762\u677f\u5e95\u90e8\u90a3\u4e00\u884c\u5feb\u6377\u952e\u7d22\u5f15\u4f1a\u9690\u85cf\u3002"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, showShortcutHints: !settings.showShortcutHints })}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      settings.showShortcutHints ? "bg-sky-500" : "bg-slate-300"
                    }`}
                    aria-pressed={settings.showShortcutHints}
                    title={settings.showShortcutHints ? "\u5df2\u663e\u793a" : "\u5df2\u9690\u85cf"}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                        settings.showShortcutHints ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs text-slate-600">{"\u4e3b\u9898\u989c\u8272"}</label>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { name: "\u77f3\u677f\u84dd", val: "#0f172a88" },
                    { name: "\u9752\u7eff\u8272", val: "#0f766e88" },
                    { name: "\u6d77\u84dd\u8272", val: "#0f4c8188" },
                    { name: "\u7425\u73c0\u8272", val: "#92400e88" },
                    { name: "\u73ab\u7ea2\u8272", val: "#9f123988" },
                  ].map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => setSettings({ ...settings, themeColor: color.val })}
                      className={`h-10 rounded-2xl border transition-transform active:scale-95 ${
                        settings.themeColor === color.val
                          ? "scale-105 border-slate-900 shadow-[0_0_0_3px_rgba(148,163,184,0.2)]"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.val.slice(0, 7) }}
                      title={color.name}
                    />
                  ))}
                </div>
                <div className="mt-4">
                  <span className="mb-2 block text-xs text-slate-500">{"\u81ea\u5b9a\u4e49\u989c\u8272\uff08Hex + Alpha\uff09"}</span>
                  <input
                    value={settings.themeColor}
                    onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                    className="w-full cursor-text rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[20px] border border-slate-200 bg-slate-50/90 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{"\u5b58\u50a8\u4e0e\u5bfc\u5165\u5bfc\u51fa"}</div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{"\u5df2\u4f7f\u7528\u7a7a\u95f4"}</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">{storageUsage}</div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void onBackup()}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                  title={"\u5bfc\u51fa\u5b8c\u6574 JSON \u5907\u4efd"}
                >
                  {"\u5907\u4efd\u5168\u90e8"}
                </button>
                <label
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-700 transition-colors hover:bg-slate-100"
                  title={"\u4ece JSON \u5907\u4efd\u6062\u590d"}
                >
                  {"\u6062\u590d\u5907\u4efd"}
                  <input type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} />
                </label>
                <button
                  type="button"
                  onClick={() => void onExportTxt()}
                  className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 transition-colors hover:bg-sky-100"
                  title={"\u5bfc\u51fa TXT"}
                >
                  {"\u5bfc\u51fa TXT"}
                </button>
                <label
                  className="cursor-pointer rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm text-sky-700 transition-colors hover:bg-sky-100"
                  title={"\u5bfc\u5165 TXT"}
                >
                  {"\u5bfc\u5165 TXT"}
                  <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleImportTxt} />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <button
                  type="button"
                  onClick={() => setShowFormatGuide((value) => !value)}
                  className="flex w-full items-center justify-between text-left font-semibold"
                >
                  <span>{"\u683c\u5f0f\u8bf4\u660e"}</span>
                  {showFormatGuide ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {showFormatGuide && (
                  <div className="mt-3 space-y-2 leading-6">
                    <div>{"`\u5907\u4efd\u5168\u90e8` \u5bfc\u51fa\u7684\u662f JSON \u5907\u4efd\u6587\u4ef6\uff0c\u53ea\u80fd\u901a\u8fc7 `\u6062\u590d\u5907\u4efd` \u5bfc\u56de\u3002"}</div>
                    <div>{"`\u5bfc\u51fa TXT` \u5bfc\u51fa\u7684\u662f\u53ef\u8bfb\u6587\u672c\u683c\u5f0f\uff0c\u9002\u5408\u5206\u4eab\u3001\u7f16\u8f91\u540e\u518d\u5bfc\u5165\u3002"}</div>
                    <div className="font-medium">{"TXT \u5bfc\u5165\u652f\u6301\u7684\u63a8\u8350\u683c\u5f0f\uff1a"}</div>
                    <pre className="overflow-x-auto rounded-xl bg-white/80 p-3 text-[11px] leading-5 text-slate-700">
                      {txtExample}
                    </pre>
                    <div>{"\u63d0\u793a\uff1a\u6bcf\u6761\u63d0\u793a\u8bcd\u4e4b\u95f4\u7528 `---` \u5206\u9694\uff0c`\u5185\u5bb9:` \u540e\u9762\u652f\u6301\u591a\u884c\u3002"}</div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleClose()}
              className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              {"\u53d6\u6d88"}
            </button>
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-sky-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
            >
              {"\u4fdd\u5b58\u8bbe\u7f6e"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
