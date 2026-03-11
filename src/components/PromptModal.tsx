import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CATEGORIES, getCategoryLabel } from '../store';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (e: React.FormEvent) => void;
    editingId: string | null;
    title: string;
    setTitle: (title: string) => void;
    content: string;
    setContent: (content: string) => void;
    category: string;
    setCategory: (category: string) => void;
    shortcut: string;
    setShortcut: (shortcut: string) => void;
}

function normalizeShortcutKey(key: string) {
    if (key === ' ') return 'Space';
    if (key.length === 1) return key.toUpperCase();

    const aliases: Record<string, string> = {
        ArrowUp: 'Up',
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right',
        Enter: 'Enter',
        Escape: 'Escape',
        Tab: 'Tab',
        Backspace: 'Backspace',
        Delete: 'Delete',
        Insert: 'Insert',
        Home: 'Home',
        End: 'End',
        PageUp: 'PageUp',
        PageDown: 'PageDown',
    };

    return aliases[key] ?? key;
}

export default function PromptModal({
    isOpen,
    onClose,
    onSave,
    editingId,
    title,
    setTitle,
    content,
    setContent,
    category,
    setCategory,
    shortcut,
    setShortcut
}: PromptModalProps) {
    if (!isOpen) return null;

    const handleClose = async () => {
        onClose();
        await invoke('set_input_mode', { enable: false });
        await invoke('set_panel_expanded', { expanded: false });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm">
            <div className="max-h-[calc(100vh-40px)] w-[90%] max-w-2xl overflow-hidden rounded-[22px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,252,0.98))] text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
                <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,244,248,0.92))] px-6 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-600/80">提示词编辑</div>
                    <h3 className="mt-1.5 text-lg font-semibold text-slate-900">{editingId ? '编辑提示词' : '新建提示词'}</h3>
                    <p className="mt-1 text-sm text-slate-500">尽量简洁、可复用，并便于快速触发。</p>
                </div>

                <form onSubmit={onSave} className="max-h-[calc(100vh-150px)] space-y-4 overflow-y-auto px-6 py-5">
                    <div className="grid gap-3 md:grid-cols-[1.5fr_0.85fr]">
                        <label className="block">
                            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">标题</span>
                            <input 
                                id="title"
                                required
                                autoFocus
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-4 focus:ring-sky-100 select-text cursor-text"
                                onKeyDown={async (e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Escape') {
                                        await handleClose();
                                    }
                                }}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">分类</span>
                            <select 
                                id="category"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-4 focus:ring-sky-100 cursor-pointer"
                                onKeyDown={async (e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Escape') {
                                        await handleClose();
                                    }
                                }}
                            >
                                {CATEGORIES.map(c => <option key={c} value={c}>{getCategoryLabel(c)}</option>)}
                            </select>
                        </label>
                    </div>

                    <div className="rounded-[20px] border border-slate-200 bg-slate-50/90 p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">快捷键</div>
                                <p className="mt-1 text-sm text-slate-500">点击输入框后，按下类似 <span className="font-medium text-slate-700">Ctrl+Shift+1</span> 的组合键。</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShortcut('')}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                            >
                                清空
                            </button>
                        </div>
                        <input
                            id="shortcut"
                            value={shortcut}
                            placeholder="按下快捷键"
                            readOnly
                            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-4 focus:ring-sky-100 select-none cursor-default"
                            onKeyDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
                                    setShortcut('');
                                    return;
                                }

                                if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                                    return;
                                }

                                const parts = [];
                                if (e.ctrlKey) parts.push('Ctrl');
                                if (e.altKey) parts.push('Alt');
                                if (e.shiftKey) parts.push('Shift');
                                if (e.metaKey) parts.push('Meta');

                                setShortcut([...parts, normalizeShortcutKey(e.key)].join('+'));
                            }}
                        />
                    </div>

                    <label className="block">
                        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">内容</span>
                        <textarea 
                            id="content"
                            required
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            className="min-h-[180px] w-full rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition-colors focus:border-sky-400 focus:ring-4 focus:ring-sky-100 resize-y select-text cursor-text"
                            onKeyDown={async (e) => {
                                e.stopPropagation();
                                if (e.key === 'Escape') {
                                    await handleClose();
                                }
                            }} 
                        />
                    </label>

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={handleClose} className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">取消</button>
                        <button type="submit" className="flex-1 rounded-2xl bg-sky-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600">保存提示词</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
