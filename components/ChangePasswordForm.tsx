import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Key, Check } from 'lucide-react';
import { getCurrentUser } from '../services/authService';

interface ChangePasswordFormProps {
    onSuccess?: () => void;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({ onSuccess }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const currentUser = getCurrentUser();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        // Client-side validation
        if (!oldPassword) {
            setError('请输入旧密码');
            return;
        }

        if (newPassword.length < 6) {
            setError('新密码长度不能少于6位');
            return;
        }

        if (newPassword === oldPassword) {
            setError('新密码不能与旧密码相同');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('两次输入的新密码不一致');
            return;
        }

        setLoading(true);

        try {
            // Import updateMyPassword dynamically to avoid circular dependencies
            const { updateMyPassword } = await import('../services/storageService');

            if (!currentUser?.id) {
                throw new Error('用户未登录');
            }

            await updateMyPassword(currentUser.id, oldPassword, newPassword);

            setSuccess(true);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');

            setTimeout(() => {
                if (onSuccess) onSuccess();
            }, 1500);
        } catch (err: any) {
            setError(err.message || '修改密码失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                    <Check size={16} />
                    密码修改成功！
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Old Password */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Key size={14} />
                        旧密码
                    </label>
                    <div className="relative">
                        <input
                            type={showPasswords ? 'text' : 'password'}
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="请输入旧密码"
                            disabled={loading || success}
                        />
                        <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>

                {/* New Password */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Lock size={14} />
                        新密码
                    </label>
                    <input
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="至少6位字符"
                        disabled={loading || success}
                    />
                </div>

                {/* Confirm Password */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Lock size={14} />
                        确认新密码
                    </label>
                    <input
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="再次输入新密码"
                        disabled={loading || success}
                    />
                </div>

                {/* Show Password Toggle */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
                        disabled={loading || success}
                    >
                        {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                        {showPasswords ? '隐藏密码' : '显示密码'}
                    </button>
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || success}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                    {loading ? (
                        <>
                            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            处理中...
                        </>
                    ) : (
                        <>
                            <Lock size={16} />
                            确认修改
                        </>
                    )}
                </button>
            </form>

            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-600">
                    💡 <strong>密码安全提示：</strong>
                </p>
                <ul className="text-xs text-slate-500 mt-2 space-y-1 ml-4 list-disc">
                    <li>密码长度至少6位</li>
                    <li>建议使用大小写字母、数字和特殊字符的组合</li>
                    <li>不要使用过于简单的密码</li>
                </ul>
            </div>
        </div>
    );
};

export default ChangePasswordForm;
