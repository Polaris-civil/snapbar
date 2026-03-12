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

const txtExample = `标题: 示例提示词
分类: 通用
快捷键: Alt+1
内容:
这里填写正文内容，可以换行。

---

标题: 第二条提示词
分类: 代码
快捷键:
内容:
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
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-600/80">工作区设置</div>
          <h3 className="mt-1.5 text-lg font-semibold text-slate-900">设置</h3>
          <p className="mt-1 text-sm text-slate-500">管理外观、备份恢复和 TXT 导入导出规则。</p>
        </div>

        <form onSubmit={onSave} className="max-h-[calc(100vh-150px)] space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-4">
            <section className="rounded-[20px] border border-slate-200 bg-slate-50/90 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">外观</div>
              <div className="mt-4">
                <label className="mb-2 block text-xs text-slate-600">
                  按钮大小：{typeof settings.buttonSize === "number" ? `${settings.buttonSize}%` : settings.buttonSize}
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
                      <span>小</span>
                      <span>默认</span>
                      <span>大</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">预览</div>
                    <div className="mt-3 flex min-h-[72px] items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(226,232,240,0.8),rgba(241,245,249,0.95))]">
                      <button
                        type="button"
                        style={previewStyle}
                        className="rounded-xl border border-slate-300 bg-slate-900/90 font-medium text-white shadow-sm"
                      >
                        示例按钮
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs text-slate-600">主题颜色</label>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { name: "石板蓝", val: "#0f172a88" },
                    { name: "青绿色", val: "#0f766e88" },
                    { name: "海蓝色", val: "#0f4c8188" },
                    { name: "琥珀色", val: "#92400e88" },
                    { name: "玫红色", val: "#9f123988" },
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
                  <span className="mb-2 block text-xs text-slate-500">自定义颜色（Hex + Alpha）</span>
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
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">存储与导入导出</div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">占用空间</div>
                <div className="mt-1 text-lg font-semibold text-slate-800">{storageUsage}</div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void onBackup()}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                  title="导出完整 JSON 备份"
                >
                  备份全部
                </button>
                <label
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-700 transition-colors hover:bg-slate-100"
                  title="从 JSON 备份恢复"
                >
                  恢复备份
                  <input type="file" accept=".json,application/json" className="hidden" onChange={handleRestore} />
                </label>
                <button
                  type="button"
                  onClick={() => void onExportTxt()}
                  className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 transition-colors hover:bg-sky-100"
                  title="导出 TXT"
                >
                  导出 TXT
                </button>
                <label
                  className="cursor-pointer rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm text-sky-700 transition-colors hover:bg-sky-100"
                  title="导入 TXT"
                >
                  导入 TXT
                  <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleImportTxt} />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <button
                  type="button"
                  onClick={() => setShowFormatGuide((value) => !value)}
                  className="flex w-full items-center justify-between text-left font-semibold"
                >
                  <span>格式说明</span>
                  {showFormatGuide ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {showFormatGuide && (
                  <div className="mt-3 space-y-2 leading-6">
                    <div>`备份全部` 导出的是 JSON 备份文件，只能通过 `恢复备份` 导回。</div>
                    <div>`导出 TXT` 导出的是可读文本格式，适合分享、编辑后再导入。</div>
                    <div className="font-medium">TXT 导入支持的推荐格式：</div>
                    <pre className="overflow-x-auto rounded-xl bg-white/80 p-3 text-[11px] leading-5 text-slate-700">
                      {txtExample}
                    </pre>
                    <div>提示：每条提示词之间用 `---` 分隔，`内容:` 后面支持多行。</div>
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
              取消
            </button>
            <button
              type="submit"
              className="flex-1 rounded-2xl bg-sky-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
            >
              保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
