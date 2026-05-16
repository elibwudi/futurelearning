
import React, { useState } from 'react';
import { Course, User } from '../types';
import { BookOpen, Plus, User as UserIcon, Trash2, GraduationCap, Sparkles, Settings, RefreshCw, Server, Info, LogOut, ShieldCheck, Edit, CheckCircle, CircleDashed, Eye, EyeOff, Users } from 'lucide-react';

interface DashboardProps {
  courses: Course[];
  currentUser: User;
  onSelectCourse: (course: Course) => void;
  onCreateCourse: () => void;
  onEditCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onToggleVisibility?: (course: Course) => void;
  onManagePermissions?: (course: Course) => void; // NEW: Permission management
  onTeacherToggle: () => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  courses,
  currentUser,
  onSelectCourse,
  onCreateCourse,
  onEditCourse,
  onDeleteCourse,
  onToggleVisibility,
  onManagePermissions,
  onTeacherToggle,
  onOpenSettings,
  onRefresh,
  onLogin,
  onLogout
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = () => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  const isDevMode = window.location.port === '5173' || window.location.port === '3000' || window.location.port === '3008';

  // Security Check: Role based
  const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <GraduationCap className="text-blue-600" size={36} />
              认知图谱学习平台
            </h1>

            {/* 核心修复：状态标签严格隔离 */}
            {isTeacherOrAdmin && (
              <div className="flex items-center gap-2 mt-2 animate-in fade-in">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${currentUser.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                  <ShieldCheck size={10} /> {currentUser.role === 'admin' ? '系统管理员' : '教师后台'}
                </span>
                {isDevMode && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                    <Info size={10} /> 开发模式 ({window.location.port} → 3001)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end mr-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">当前身份</span>
                <div className="flex items-center gap-2 font-medium text-slate-700">
                  {isTeacherOrAdmin ? (
                    <span className="text-blue-600 flex items-center gap-1"><ShieldCheck size={14} /> {currentUser.name}</span>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span>{currentUser.name}</span>
                      {currentUser.isAnonymous !== false ? (
                        <button onClick={onLogin} className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
                          点击绑定账户/同步
                        </button>
                      ) : (
                        <button onClick={onLogout} className="text-[10px] text-slate-400 hover:text-red-500 hover:underline">
                          退出登录
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={onTeacherToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${isTeacherOrAdmin
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 shadow-sm'
                  }`}
                title={isTeacherOrAdmin ? "退出管理" : "教师登录"}
              >
                {isTeacherOrAdmin ? <LogOut size={16} /> : <UserIcon size={16} />}
                {isTeacherOrAdmin ? "退出管理" : "我是老师"}
              </button>

              {/* 核心修复：设置按钮严格隔离 */}
              {isTeacherOrAdmin && (
                <>
                  <div className="w-px h-6 bg-slate-300 mx-1"></div>
                  <button
                    onClick={onOpenSettings}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
                    title="系统设置"
                  >
                    <Settings size={20} />
                  </button>
                </>
              )}
            </div>

            {isTeacherOrAdmin && (
              <button
                onClick={onCreateCourse}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all text-sm font-medium"
              >
                <Plus size={16} />
                创建新课程
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-700">课程列表</h2>
          <button
            onClick={handleManualRefresh}
            className="text-slate-400 hover:text-blue-600 transition-colors p-2 rounded-full hover:bg-slate-100"
            title="刷新列表"
          >
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Teacher Action Card */}
          {isTeacherOrAdmin && (
            <div
              onClick={onCreateCourse}
              className="group bg-white border-2 border-dashed border-blue-200 rounded-xl flex flex-col items-center justify-center p-8 cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all min-h-[280px]"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                <Plus size={32} />
              </div>
              <h3 className="text-lg font-bold text-blue-800 mb-2">发布新课程</h3>
              <p className="text-sm text-slate-500 text-center max-w-[200px]">
                上传 PDF 教材，AI 自动提取知识点并生成学习图谱。
              </p>
            </div>
          )}

          {courses.length === 0 && !isTeacherOrAdmin ? (
            <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <BookOpen size={32} />
              </div>
              <h3 className="text-xl font-medium text-slate-700 mb-2">暂无课程</h3>
              <p className="text-slate-500 max-w-sm mx-auto mb-4">
                目前还没有发布的课程。请联系“AI赋能老师”发布新课程。
              </p>
              <button onClick={onRefresh} className="text-blue-600 hover:underline text-sm">刷新列表</button>
            </div>
          ) : (
            courses.map(course => {
              const isReady = course.status !== 'hidden';
              const isHidden = course.status === 'hidden';

              // Permission Logic (Fixed):
              // Use hasPermission from backend which checks:
              // 1. Admin always has permission
              // 2. Teacher has permission if they are the author OR in the permissions table
              const canEdit = course.hasPermission === true;

              return (
                <div
                  key={course.id}
                  className={`group bg-white rounded-xl border shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden relative ${isHidden ? 'border-slate-200 opacity-75' : 'border-emerald-200 hover:border-emerald-400'}`}
                >
                  {/* Decorative Banner */}
                  <div className={`h-32 p-6 flex items-start justify-between relative overflow-hidden ${isHidden ? 'bg-slate-100' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                    <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full -mr-4 -mt-4 blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 p-10 bg-black/5 rounded-full -ml-6 -mb-6 blur-xl"></div>

                    <div className="relative z-10 flex flex-col items-start gap-1.5">
                      <span className={`inline-block px-2 py-1 bg-white/20 backdrop-blur rounded text-xs px-2 font-medium ${isHidden ? 'text-slate-500' : 'text-white'}`}>
                        <Sparkles size={12} className="inline mr-1" />
                        {course.graphData?.nodes ? course.graphData.nodes.length : 0} 个知识点
                      </span>
                      {isHidden ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-200 text-slate-500 rounded text-[10px] font-bold shadow-sm">
                          <EyeOff size={10} /> 已隐藏 (学生不可见)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/90 text-emerald-700 rounded text-[10px] font-bold shadow-sm">
                          <CheckCircle size={10} /> 已发布
                        </span>
                      )}
                    </div>

                    {canEdit && (
                      <div className="relative z-10 flex gap-2">
                        {onToggleVisibility && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleVisibility(course); }}
                            className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors"
                            title={isHidden ? "显示课程" : "隐藏课程"}
                          >
                            {isHidden ? <EyeOff size={16} className="text-slate-500" /> : <Eye size={16} />}
                          </button>
                        )}
                        {currentUser.role === 'admin' && onManagePermissions && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onManagePermissions(course); }}
                            className={`p-2 rounded-lg transition-colors ${isHidden ? 'bg-white/50 text-slate-600 hover:bg-white' : 'bg-white/20 hover:bg-white/40 text-white'}`}
                            title="权限管理"
                          >
                            <Users size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditCourse(course); }}
                          className={`p-2 rounded-lg transition-colors ${isHidden ? 'bg-white/50 text-slate-600 hover:bg-white' : 'bg-white/20 hover:bg-white/40 text-white'}`}
                          title="编辑图谱"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteCourse(course.id); }}
                          className={`p-2 rounded-lg transition-colors ${isHidden ? 'bg-white/50 text-slate-600 hover:bg-red-100 hover:text-red-500' : 'bg-white/20 hover:bg-red-500/80 text-white'}`}
                          title="删除课程"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className={`text-xl font-bold text-slate-800 mb-2 line-clamp-1 transition-colors ${isHidden ? 'text-slate-500' : 'group-hover:text-emerald-600'}`}>
                      {course.title}
                    </h3>
                    <p className="text-slate-500 text-sm mb-6 line-clamp-2 flex-1">
                      {course.description || "暂无描述"}
                    </p>

                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs text-slate-400">
                        发布于 {new Date(course.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => onSelectCourse(course)}
                        className={`px-4 py-2 bg-slate-50 text-slate-700 text-sm font-medium rounded-lg hover:text-white transition-all flex items-center gap-1 ${isHidden ? 'hover:bg-slate-400 opacity-50' : 'hover:bg-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'}`}
                      >
                        进入学习
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
