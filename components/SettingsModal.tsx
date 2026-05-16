
import React, { useState, useEffect } from 'react';
import { X, Save, Server, Activity, Check, AlertCircle, Bot, Zap, Cpu, User } from 'lucide-react';
import { AISettings } from '../types';
import { getSettings, saveSettings, testConnection } from '../services/geminiService';
import { checkBackendHealth, getAnonymousUser } from '../services/storageService';
import UserManagement from './UserManagement';
import ChangePasswordForm from './ChangePasswordForm';
// Removed unused authService import if not needed, or fix it. Assuming it's not strictly needed for UI props check as we use currentUser prop.

interface SettingsModalProps {
    onClose: () => void;
    currentUser?: any;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, currentUser }) => {
    const [settings, setSettings] = useState<AISettings | null>(null);
    const [loading, setLoading] = useState(true);

    const [testingAI, setTestingAI] = useState(false);
    const [aiTestResult, setAiTestResult] = useState<{ success: boolean, message: string } | null>(null);

    const [activeTab, setActiveTab] = useState<'SYSTEM' | 'USERS' | 'PROFILE'>('SYSTEM');

    const [testingBackend, setTestingBackend] = useState(false);
    const [backendTestResult, setBackendTestResult] = useState<{ success: boolean, message: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const s = await getSettings();
                setSettings(s);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        if (!settings) return;
        try {
            await saveSettings(settings);
            onClose();
            alert("设置已保存并同步到服务器。");
        } catch (e: any) {
            alert("保存失败: " + e.message);
        }
    };

    const handleTestAI = async () => {
        if (!settings) return;
        setTestingAI(true);
        setAiTestResult(null);
        try {
            await saveSettings(settings);
            const result = await testConnection();
            setAiTestResult(result);
        } catch (e: any) {
            setAiTestResult({ success: false, message: "保存配置失败，无法测试" });
        } finally {
            setTestingAI(false);
        }
    };

    const handleTestBackend = async () => {
        setTestingBackend(true);
        setBackendTestResult(null);
        const result = await checkBackendHealth();
        setBackendTestResult(result);
        setTestingBackend(false);
    };

    if (loading || !settings) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl animate-pulse">正在加载服务器配置...</div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        系统设置 (服务器端)
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b border-slate-100">
                    {currentUser?.role === 'admin' && (
                        <>
                            <button
                                onClick={() => setActiveTab('SYSTEM')}
                                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'SYSTEM' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                系统配置
                            </button>
                            <button
                                onClick={() => setActiveTab('USERS')}
                                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'USERS' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                用户管理
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setActiveTab('PROFILE')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'PROFILE' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <User size={14} />
                        个人中心
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {activeTab === 'USERS' && currentUser?.role === 'admin' ? (
                        <UserManagement />
                    ) : activeTab === 'PROFILE' ? (
                        <>
                            <div className="space-y-2">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <User size={18} />
                                    修改密码
                                </h3>
                                <p className="text-sm text-slate-500">
                                    为了您的账号安全，请定期更新密码
                                </p>
                            </div>
                            <ChangePasswordForm onSuccess={() => alert('密码修改成功！请重新登录。')} />
                        </>
                    ) : (
                        <>
                            <section className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <Server size={12} /> 后端服务状态
                                </h3>
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                                    <span className="text-sm text-slate-600">BS 模式 (自动连接)</span>
                                    <button
                                        onClick={handleTestBackend}
                                        disabled={testingBackend}
                                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                                    >
                                        {testingBackend ? <span className="animate-spin w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full" /> : <Activity size={14} />}
                                        检查连接
                                    </button>
                                </div>
                                {backendTestResult && (
                                    <div className={`text-xs flex items-center gap-2 ${backendTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                        {backendTestResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
                                        {backendTestResult.message}
                                    </div>
                                )}
                            </section>

                            <hr className="border-slate-100" />

                            {currentUser?.role === 'admin' ? (
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <Bot size={12} /> AI 模型设置
                                        </h3>
                                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                            设置将同步给所有用户
                                        </span>
                                    </div>

                                    <div className="flex p-1 bg-slate-100 rounded-lg">
                                        <button
                                            onClick={() => setSettings({ ...settings!, provider: 'deepseek' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${settings.provider === 'deepseek' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Zap size={12} /> DeepSeek
                                        </button>
                                        <button
                                            onClick={() => setSettings({ ...settings!, provider: 'zhipu' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${settings.provider === 'zhipu' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Bot size={12} /> 智谱 AI
                                        </button>
                                        <button
                                            onClick={() => setSettings({ ...settings!, provider: 'qwen' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${settings.provider === 'qwen' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Bot size={12} /> Qwen
                                        </button>
                                        <button
                                            onClick={() => setSettings({ ...settings!, provider: 'openai' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${settings.provider === 'openai' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Cpu size={12} /> Local
                                        </button>
                                        <button
                                            onClick={() => setSettings({ ...settings!, provider: 'gemini' })}
                                            className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${settings.provider === 'gemini' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Bot size={12} /> Gemini
                                        </button>
                                    </div>

                                    {/* AI Provider Config Inputs - Simplified for brevity in restoration but ensuring correctness */}
                                    {settings.provider === 'deepseek' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">API Key (DeepSeek)</label>
                                                <input type="password" value={settings.deepseekApiKey} onChange={(e) => setSettings({ ...settings!, deepseekApiKey: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">模型名称</label>
                                                <input type="text" value={settings.deepseekModel} onChange={(e) => setSettings({ ...settings!, deepseekModel: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                            </div>
                                        </div>
                                    )}
                                    {settings.provider === 'zhipu' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">API Key (智谱 AI)</label>
                                                <input type="password" value={settings.zhipuApiKey} onChange={(e) => setSettings({ ...settings!, zhipuApiKey: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">模型名称</label>
                                                <input type="text" value={settings.zhipuModel} onChange={(e) => setSettings({ ...settings!, zhipuModel: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                            </div>
                                        </div>
                                    )}
                                    {settings.provider === 'qwen' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">API Key (Qwen)</label>
                                                <input type="password" value={settings.qwenApiKey} onChange={(e) => setSettings({ ...settings!, qwenApiKey: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">模型名称</label>
                                                <input type="text" value={settings.qwenModel} onChange={(e) => setSettings({ ...settings!, qwenModel: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                            </div>
                                        </div>
                                    )}
                                    {settings.provider === 'openai' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">API 地址 (Base URL)</label>
                                                <input type="text" value={settings.openaiBaseUrl} onChange={(e) => setSettings({ ...settings!, openaiBaseUrl: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="http://10.255.1.118:8000/v1" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">API 密钥 (API Key)</label>
                                                <input type="password" value={settings.openaiApiKey} onChange={(e) => setSettings({ ...settings!, openaiApiKey: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="sk-..." />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">模型名称</label>
                                                <input type="text" value={settings.openaiModel} onChange={(e) => setSettings({ ...settings!, openaiModel: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="gemma-4-moe" />
                                            </div>
                                        </div>
                                    )}
                                    {settings.provider === 'gemini' && (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">API Key (Google Gemini)</label>
                                                <input type="password" value={settings.geminiApiKey} onChange={(e) => setSettings({ ...settings!, geminiApiKey: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">模型名称</label>
                                                <input type="text" value={settings.geminiModel} onChange={(e) => setSettings({ ...settings!, geminiModel: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <button onClick={handleTestAI} disabled={testingAI} className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors">
                                            {testingAI ? <span className="animate-spin w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full" /> : <Activity size={14} />}
                                            测试 AI 连接
                                        </button>

                                        {aiTestResult && (
                                            <div className={`mt-2 text-xs flex items-center gap-2 ${aiTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                                                {aiTestResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
                                                {aiTestResult.message}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                                    <p className="text-sm text-slate-500">AI 模型设置由管理员统一管理。</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end items-center">
                    {activeTab === 'SYSTEM' && (
                        <button
                            onClick={handleSave}
                            className="bg-slate-800 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-700 shadow-sm"
                        >
                            <Save size={18} /> 保存配置
                        </button>
                    )}
                </div>
            </div >
        </div >
    );
};

export default SettingsModal;
