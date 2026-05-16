
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users, ShieldCheck, AlertCircle } from 'lucide-react';
import { Course, User } from '../types';
import { apiCall } from '../services/authService';

interface CoursePermissionsModalProps {
    course: Course;
    currentUser: User;
    onClose: () => void;
    onSuccess: () => void;
}

interface Permission {
    userId: string;
    name: string;
    username: string;
    role: string;
    permissionLevel: 'owner' | 'member';
    grantedAt: number;
    grantedBy?: string;
}

const CoursePermissionsModal: React.FC<CoursePermissionsModalProps> = ({
    course,
    currentUser,
    onClose,
    onSuccess
}) => {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [allTeachers, setAllTeachers] = useState<User[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [selectedPermissionLevel, setSelectedPermissionLevel] = useState<'owner' | 'member'>('member');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Load permissions list
    useEffect(() => {
        loadPermissions();
    }, [course.id]);

    // Load all teachers
    useEffect(() => {
        apiCall('/users')
            .then(users => {
                const teachers = users.filter((u: User) => u.role === 'teacher' || u.role === 'admin');
                setAllTeachers(teachers);
            })
            .catch(err => {
                console.error('Failed to load teachers:', err);
            });
    }, []);

    const loadPermissions = async () => {
        setLoading(true);
        try {
            const data = await apiCall(`/courses/${course.id}/permissions`);
            setPermissions(data);
        } catch (e) {
            console.error('Failed to load permissions', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPermission = async () => {
        if (!selectedTeacherId) return;

        setSubmitting(true);
        try {
            const data = await apiCall(`/courses/${course.id}/permissions`, {
                method: 'POST',
                body: JSON.stringify({
                    teacherId: selectedTeacherId,
                    permissionLevel: selectedPermissionLevel,
                    adminId: currentUser.id,
                    adminRole: currentUser.role
                })
            });

            alert(`✅ ${data.message}`);
            setSelectedTeacherId('');
            setSelectedPermissionLevel('member'); // Reset to default
            loadPermissions();
            onSuccess();
        } catch (e: any) {
            alert(`❌ ${e.message || '操作失败'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemovePermission = async (userId: string, userName: string) => {
        if (!confirm(`确定要移除 ${userName} 的权限吗？`)) return;

        try {
            const data = await apiCall(
                `/courses/${course.id}/permissions/${userId}?adminRole=${currentUser.role}`,
                { method: 'DELETE' }
            );

            alert(`✅ ${data.message}`);
            loadPermissions();
            onSuccess();
        } catch (e: any) {
            alert(`❌ ${e.message || '操作失败'}`);
        }
    };

    // Get available teachers (not already having permission)
    const availableTeachers = allTeachers.filter(
        t => !permissions.find(p => p.userId === t.id) && t.id !== course.authorId
    );

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-gradient-to-r from-blue-500 to-purple-600">
                    <div>
                        <h2 className="font-bold text-white text-lg flex items-center gap-2">
                            <Users size={20} />
                            课程权限管理
                        </h2>
                        <p className="text-blue-100 text-sm mt-1">{course.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                    {/* Creator Info */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-amber-800 text-sm font-medium mb-2">
                            <ShieldCheck size={16} />
                            课程创建者（永久权限）
                        </div>
                        <div className="text-amber-900 font-medium">
                            {allTeachers.find(t => t.id === course.authorId)?.name || '未知'}
                        </div>
                    </div>

                    {/* Current Permissions */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Users size={14} />
                            已授权教师 ({permissions.length})
                        </h3>

                        {loading ? (
                            <div className="text-center py-8 text-slate-400">加载中...</div>
                        ) : permissions.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                                暂无授权教师
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {permissions.map(perm => (
                                    <div
                                        key={perm.userId}
                                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="font-medium text-slate-800">{perm.name}</div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${perm.permissionLevel === 'owner'
                                                    ? 'bg-amber-100 text-amber-700 border border-amber-300'
                                                    : 'bg-blue-100 text-blue-700 border border-blue-300'
                                                    }`}>
                                                    {perm.permissionLevel === 'owner' ? '课程责任教师' : '课程团队成员'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                @{perm.username} · {perm.role === 'admin' ? '管理员' : '教师'} ·
                                                授予于 {new Date(perm.grantedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemovePermission(perm.userId, perm.name)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="移除权限"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add New Permission */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Plus size={14} />
                            添加教师权限
                        </h3>

                        {availableTeachers.length === 0 ? (
                            <div className="text-center py-4 text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                                <AlertCircle size={20} className="mx-auto mb-2 opacity-50" />
                                <div className="text-sm">所有教师都已拥有权限</div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <select
                                    value={selectedPermissionLevel}
                                    onChange={(e) => setSelectedPermissionLevel(e.target.value as 'owner' | 'member')}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={submitting}
                                >
                                    <option value="member">课程团队成员（仅编辑内容）</option>
                                    <option value="owner">课程责任教师（全部权限）</option>
                                </select>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedTeacherId}
                                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        disabled={submitting}
                                    >
                                        <option value="">-- 选择教师 --</option>
                                        {availableTeachers.map(teacher => (
                                            <option key={teacher.id} value={teacher.id}>
                                                {teacher.name} (@{teacher.username})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddPermission}
                                        disabled={!selectedTeacherId || submitting}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm font-medium"
                                    >
                                        {submitting ? (
                                            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                        ) : (
                                            <Plus size={16} />
                                        )}
                                        授权
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CoursePermissionsModal;
