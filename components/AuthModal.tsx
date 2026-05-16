
import React, { useState } from 'react';
import { User } from '../types';
import { login, signup } from '../services/authService';
import { getAnonymousUser } from '../services/storageService';
import { X, User as UserIcon, LogIn, UserPlus } from 'lucide-react';

interface AuthModalProps {
    onClose: () => void;
    onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            let user: User;
            if (mode === 'login') {
                user = await login(username, password);
            } else {
                // For signup, we pass the current anonymous ID to migrate data
                const anonUser = getAnonymousUser();
                user = await signup(username, password, undefined, anonUser.id);
            }
            onSuccess(user);
            onClose();
        } catch (err: any) {
            setError(err.message || "操作失败，请重试");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex border-b border-slate-100">
                    <button
                        onClick={() => { setMode('login'); setError(null); }}
                        className={`flex-1 py-4 text-sm font-bold transition-colors ${mode === 'login' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        登录账户
                    </button>
                    <button
                        onClick={() => { setMode('signup'); setError(null); }}
                        className={`flex-1 py-4 text-sm font-bold transition-colors ${mode === 'signup' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        注册新用户
                    </button>
                    <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {mode === 'signup' && (
                        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs leading-relaxed mb-2">
                            <span className="font-bold block mb-1">💡 同步提示</span>
                            注册后，您当前的匿名学习进度将自动同步到新账户，方便您在不同设备间无缝切换。
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 animate-in slide-in-from-top-2">
                            <span>⚠️ {error}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="请输入用户名"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="请输入密码"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2.5 rounded-lg text-white font-bold shadow-md transition-all flex items-center justify-center gap-2
                            ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform active:scale-[0.98]'}`}
                    >
                        {loading ? '处理中...' : (mode === 'login' ? '立即登录' : '创建并同步')}
                    </button>
                </form>
            </div>
        </div>
    );
};
