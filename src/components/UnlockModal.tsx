import React from 'react';

interface UnlockModalProps {
    isOpen: boolean;
    unlockPassword: string;
    setUnlockPassword: (password: string) => void;
    onUnlock: (e: React.FormEvent) => void;
}

export default function UnlockModal({
    isOpen,
    unlockPassword,
    setUnlockPassword,
    onUnlock
}: UnlockModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60]">
             <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-[90%] max-w-sm p-6 text-white text-center">
                <h3 className="font-bold mb-2 text-lg">解锁提示词库</h3>
                <p className="text-xs text-gray-400 mb-4">当前提示词已加密保存。</p>
                <form onSubmit={onUnlock}>
                    <input 
                        type="password"
                        autoFocus
                        placeholder="请输入密码"
                        value={unlockPassword}
                        onChange={e => setUnlockPassword(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-sm mb-4 outline-none focus:border-blue-500"
                    />
                    <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">解锁</button>
                </form>
             </div>
        </div>
    );
}
