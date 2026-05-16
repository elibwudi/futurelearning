import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getUsers, createUser, deleteUser, resetUserPassword } from '../services/storageService';
import { Trash2, Plus, UserPlus, Shield, User as UserIcon, Loader2, KeyRound, Search, Filter } from 'lucide-react';

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');

    // Form State
    const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'teacher' });

    // 搜索和筛选逻辑
    useEffect(() => {
        let result = users;

        // 角色筛选
        if (roleFilter !== 'all') {
            result = result.filter(u => u.role === roleFilter);
        }

        // 搜索筛选
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(u =>
                (u.username && u.username.toLowerCase().includes(term)) ||
                u.name.toLowerCase().includes(term) ||
                u.id.toLowerCase().includes(term)
            );
        }

        setFilteredUsers(result);
    }, [users, searchTerm, roleFilter]);

    const fetchUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(data);
            setFilteredUsers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createUser(newUser);
            setNewUser({ username: '', password: '', name: '', role: 'teacher' });
            setAdding(false);
            fetchUsers();
            alert("用户创建成功！");
        } catch (err: any) {
            alert("创建失败: " + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("确定要删除该用户吗？")) return;
        try {
            await deleteUser(id);
            fetchUsers();
        } catch (err: any) {
            alert("删除失败: " + err.message);
        }
    };

    const handleResetPassword = async (id: string, username: string) => {
        const newPassword = window.prompt(`重置用户 "${username}" 的密码\n请输入新密码 (至少6位):`);

        if (newPassword === null) {
            return;
        }
        if (newPassword.length < 6) {
            alert("密码长度不能少于6位");
            return;
        }

        try {
            await resetUserPassword(id, newPassword);
            alert("密码重置成功！");
        } catch (err: any) {
            alert("重置失败: " + err.message);
        }
    };

    if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <UserIcon size={16} /> 用户账户管理
                </h3>
                <button
                    onClick={() => setAdding(!adding)}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md font-medium hover:bg-blue-100 flex items-center gap-1 transition-colors"
                >
                    <Plus size={14} /> 添加新用户
                </button>
            </div>

            {/* 搜索和筛选 */}
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="搜索用户名、显示名称或ID..."
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                    <option value="all">所有角色</option>
                    <option value="admin">管理员</option>
                    <option value="teacher">教师</option>
                    <option value="student">学生</option>
                </select>
            </div>

            {/* Add User Form */}
            {adding && (
                <form onSubmit={handleAddUser} className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
                    <h4 className="font-bold text-slate-700 mb-3 text-sm">添加新用户</h4>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">用户名 (登录用)</label>
                            <input
                                required
                                value={newUser.username}
                                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded"
                                placeholder="例如: teacher_li"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                            <input
                                required
                                value={newUser.name}
                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded"
                                placeholder="例如: 李老师"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">密码</label>
                            <input
                                required
                                type="password"
                                value={newUser.password}
                                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded"
                                placeholder="不少于6位"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">角色</label>
                            <select
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border rounded bg-white"
                            >
                                <option value="teacher">教师 (仅管理自己课程)</option>
                                <option value="admin">管理员 (管理所有课程)</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setAdding(false)} className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded">取消</button>
                        <button type="submit" className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">保存用户</button>
                    </div>
                </form>
            )}

            {/* 统计信息 */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-purple-50 p-2 rounded border border-purple-100">
                    <div className="text-purple-700 text-xs font-medium">管理员</div>
                    <div className="text-purple-900 font-bold">{users.filter(u => u.role === 'admin').length} 人</div>
                </div>
                <div className="bg-green-50 p-2 rounded border border-green-100">
                    <div className="text-green-700 text-xs font-medium">教师</div>
                    <div className="text-green-900 font-bold">{users.filter(u => u.role === 'teacher').length} 人</div>
                </div>
                <div className="bg-blue-50 p-2 rounded border border-blue-100">
                    <div className="text-blue-700 text-xs font-medium">总用户</div>
                    <div className="text-blue-900 font-bold">{users.length} 人</div>
                </div>
            </div>

            {/* User List */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                            <th className="px-4 py-2 text-xs">用户ID</th>
                            <th className="px-4 py-2">用户名</th>
                            <th className="px-4 py-2">显示名称</th>
                            <th className="px-4 py-2">角色</th>
                            <th className="px-4 py-2 text-xs">类型</th>
                            <th className="px-4 py-2 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map(u => (
                            <tr key={u.id} className="group hover:bg-slate-50">
                                <td className="px-4 py-2 font-mono text-[10px] text-slate-400">{u.id}</td>
                                <td className="px-4 py-2 font-mono text-slate-600">{u.username || '(匿名)'}</td>
                                <td className="px-4 py-2 text-slate-800 font-medium">{u.name}</td>
                                <td className="px-4 py-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                            u.role === 'teacher' ? 'bg-green-100 text-green-700' :
                                                'bg-slate-100 text-slate-600'
                                        }`}>
                                        {u.role === 'admin' ? <Shield size={10} /> : <UserIcon size={10} />}
                                        {u.role === 'admin' ? '管理员' : u.role === 'teacher' ? '教师' : '学生'}
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    {u.isAnonymous ? (
                                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">匿名</span>
                                    ) : (
                                        <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">正式</span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-right">
                                    {u.id !== 'u_admin' && u.id !== 't1' && (
                                        <div className="flex justify-end gap-1">
                                            {!u.isAnonymous && (
                                                <button
                                                    onClick={() => handleResetPassword(u.id, u.username)}
                                                    className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                                                    title="重置密码"
                                                >
                                                    <KeyRound size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                                title="删除用户"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredUsers.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs">
                        {searchTerm || roleFilter !== 'all' ? '无符合筛选条件的用户' : '暂无用户数据'}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
