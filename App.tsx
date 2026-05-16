
import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './components/Dashboard';
import CourseCreator from './components/CourseCreator';
import CourseLearner from './components/CourseLearner';
import SettingsModal from './components/SettingsModal';
import CoursePermissionsModal from './components/CoursePermissionsModal';
import { AuthModal } from './components/AuthModal';
import { getCourses, getCourseById, deleteCourse, initDB, getAnonymousUser, toggleCourseVisibility } from './services/storageService';
import { getSettings } from './services/geminiService';
import { getCurrentUser, logout } from './services/authService';
import { User, Course } from './types';
import { Settings, AlertTriangle, RefreshCw, Lock, X } from 'lucide-react';
import './styles/richtext.css';

type ViewState = 'DASHBOARD' | 'CREATE_COURSE' | 'LEARN_COURSE';

const App: React.FC = () => {
    // Navigation State
    const [view, setView] = useState<ViewState>('DASHBOARD');

    // Data State
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);

    // Selection State
    const [activeCourse, setActiveCourse] = useState<Course | null>(null);
    const [courseToEdit, setCourseToEdit] = useState<Course | null>(null);
    const [courseToManagePermissions, setCourseToManagePermissions] = useState<Course | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [missingKeyWarning, setMissingKeyWarning] = useState(false);

    // Teacher Auth Modal State
    const [showTeacherAuthModal, setShowTeacherAuthModal] = useState(false);
    const [authPassword, setAuthPassword] = useState("");
    const authInputRef = useRef<HTMLInputElement>(null);

    // User Auth Modal State
    const [showUserAuthModal, setShowUserAuthModal] = useState(false);

    // Initialization
    useEffect(() => {
        const init = async () => {
            // Timeout protection
            const timeoutId = setTimeout(() => {
                if (loading) {
                    setInitError("连接数据库超时 (5s)。请检查后端服务是否启动。");
                    setLoading(false);
                }
            }, 5000);

            try {
                await initDB();

                // 1. Set Identity (Prioritize Logged In User, then Anonymous)
                const loggedInUser = getCurrentUser();
                if (loggedInUser) {
                    console.log("Found Logged In User:", loggedInUser);
                    setCurrentUser(loggedInUser);
                } else {
                    const student = getAnonymousUser();
                    // Mark as anonymous for UI logic
                    if (student.isAnonymous === undefined) student.isAnonymous = true;
                    console.log("Initialized Anonymous Identity:", student);
                    setCurrentUser(student);
                }

                // 2. Load Courses (List only)
                // Pass user info to filter hidden courses correctly
                const canSeeHidden = loggedInUser?.role === 'teacher' || loggedInUser?.role === 'admin';
                const loadedCourses = await getCourses(loggedInUser?.id, loggedInUser?.role);
                setCourses(loadedCourses);

                // 3. Check AI Settings (Only warn if needed, but UI hides it for students)
                try {
                    const settings = await getSettings();
                    if ((settings.provider === 'deepseek' && !settings.deepseekApiKey) ||
                        (settings.provider === 'zhipu' && !settings.zhipuApiKey)) {
                        setMissingKeyWarning(true);
                    }
                } catch (e) {
                    console.warn("Could not load settings check", e);
                }

            } catch (e: any) {
                console.error("Initialization failed", e);
                setInitError(e.message || "未知错误");
            } finally {
                clearTimeout(timeoutId);
                setLoading(false);
            }
        };
        init();
    }, []);

    // Focus input when auth modal opens
    useEffect(() => {
        if (showTeacherAuthModal && authInputRef.current) {
            setTimeout(() => authInputRef.current?.focus(), 100);
        }
    }, [showTeacherAuthModal]);

    // Event Handlers

    const [authUsername, setAuthUsername] = useState(""); // Empty by default to avoid UX confusion

    const handleTeacherToggle = () => {
        if (!currentUser) return;

        if (currentUser.role === 'student') {
            // Student -> Teacher/Admin Login
            setAuthPassword("");
            setAuthUsername(""); // Clear username for fresh input
            setShowTeacherAuthModal(true);
        } else {
            // Logout logic for teacher -> return to student
            import('./services/authService').then(({ logout }) => {
                logout();
                const student = getAnonymousUser();
                student.isAnonymous = true;
                setCurrentUser(student);
                setView('DASHBOARD');
            });
        }
    };

    const handleAuthSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            // Call Backend Login
            // We import login from authService (ensure it's imported)
            const { login } = await import('./services/authService');
            const user = await login(authUsername, authPassword);

            if (user.role === 'student') {
                alert("该账号是学生账号，请使用教师或管理员账号登录。");
                return;
            }

            setCurrentUser(user);
            setShowTeacherAuthModal(false);

            // 🔧 FIX: Reload courses with teacher/admin permissions
            try {
                const updatedCourses = await getCourses(user.id, user.role);
                setCourses(updatedCourses);
            } catch (e) {
                console.error('Failed to reload courses after teacher login', e);
            }
        } catch (err: any) {
            alert("登录失败: " + err.message);
        } finally {
            setLoading(false);
            setAuthPassword("");
        }
    };

    const handleUserAuthSuccess = async (user: User) => {
        setCurrentUser(user);
        setShowUserAuthModal(false);

        // 🔧 FIX: Reload courses with new user permissions
        try {
            const updatedCourses = await getCourses(user.id, user.role);
            setCourses(updatedCourses);
        } catch (e) {
            console.error('Failed to reload courses after login', e);
        }
    };

    const handleUserLogout = async () => {
        if (window.confirm("确定要退出登录吗？")) {
            logout();
            const student = getAnonymousUser();
            student.isAnonymous = true;
            setCurrentUser(student);
            setView('DASHBOARD');

            // 🔧 FIX: Reload courses with student permissions (no edit access)
            try {
                const updatedCourses = await getCourses(student.id, student.role);
                setCourses(updatedCourses);
            } catch (e) {
                console.error('Failed to reload courses after logout', e);
            }
        }
    };

    const handleCreateCourse = () => {
        setCourseToEdit(null);
        setView('CREATE_COURSE');
    };

    const handleEditCourse = async (course: Course) => {
        setLoading(true);
        try {
            // Fetch full course data including rawText
            const fullCourse = await getCourseById(course.id, currentUser?.id, currentUser?.role);
            setCourseToEdit(fullCourse);
            setView('CREATE_COURSE');
        } catch (e) {
            alert("无法加载课程数据进行编辑。");
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshData = async () => {
        setLoading(true);
        try {
            const loadedCourses = await getCourses(currentUser?.id, currentUser?.role);
            setCourses(loadedCourses);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCourseSaved = async () => {
        const updatedCourses = await getCourses(currentUser?.id, currentUser?.role);
        setCourses(updatedCourses); // Refresh list
        setCourseToEdit(null);
        setView('DASHBOARD');
    };

    const handleSelectCourse = async (partialCourse: Course) => {
        setLoading(true);
        try {
            const fullCourse = await getCourseById(partialCourse.id, currentUser?.id, currentUser?.role);
            setActiveCourse(fullCourse);
            setView('LEARN_COURSE');
        } catch (e) {
            alert("无法加载课程详情，请检查网络连接。");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCourse = async (courseId: string) => {
        if (window.confirm("确定要删除这门课程吗？所有学生的进度也将一并被删除。")) {
            try {
                if (!currentUser) return;
                await deleteCourse(courseId, currentUser.id, currentUser.role);
                const updatedCourses = await getCourses(currentUser.id, currentUser.role);
                setCourses(updatedCourses);
            } catch (e: any) {
                alert("删除失败: " + e.message);
            }
        }
    };

    const handleToggleVisibility = async (course: Course) => {
        try {
            if (!currentUser) return;
            const isHidden = course.status === 'hidden';
            await toggleCourseVisibility(course.id, !isHidden);
            // Refresh list
            const updated = await getCourses(currentUser.id, currentUser.role);
            setCourses(updated);
        } catch (e: any) {
            alert("操作失败: " + e.message);
        }
    };

    const handleManagePermissions = (course: Course) => {
        setCourseToManagePermissions(course);
    };

    const handlePermissionsSuccess = async () => {
        // Refresh course list after permission changes
        try {
            const updated = await getCourses(currentUser?.id, currentUser?.role);
            setCourses(updated);
        } catch (e) {
            console.error('Failed to refresh courses', e);
        }
    };

    // --- Router Render ---

    if (initError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-600 p-8">
                <div className="max-w-lg text-center">
                    <h2 className="text-2xl font-bold mb-4">系统启动失败</h2>
                    <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm text-left mb-6">
                        <h3 className="font-bold text-red-700 mb-2 flex items-center gap-2">
                            <AlertTriangle size={18} /> 数据库连接错误
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                            无法连接到后端服务。请确保 'node server.js' 已启动，且未被防火墙拦截。
                        </p>
                        <pre className="text-xs text-slate-500 bg-slate-100 p-2 rounded overflow-auto max-h-20 whitespace-pre-wrap font-mono">
                            {initError}
                        </pre>
                    </div>

                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 font-medium flex items-center gap-2"
                        >
                            <RefreshCw size={16} />
                            刷新重试
                        </button>

                        {/* Emergency Config Button - Keep visible for troubleshooting connection */}
                        <button
                            onClick={() => setShowSettings(true)}
                            className="bg-white border border-slate-300 text-slate-700 px-6 py-2 rounded hover:bg-slate-50 flex items-center justify-center gap-2 text-sm"
                        >
                            <Settings size={16} />
                            配置服务器地址
                        </button>
                    </div>
                </div>
                {/* Render Modal conditionally even in error state */}
                {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            </div>
        );
    }

    // Global loading
    if (loading && courses.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p>正在连接数据库...</p>
                </div>
            </div>
        );
    }

    // Transition loading
    if (loading && view === 'DASHBOARD' && courses.length > 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50/50 backdrop-blur z-50 fixed inset-0">
                <div className="text-center bg-white p-6 rounded-xl shadow-lg">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">正在加载课程内容...</p>
                </div>
            </div>
        );
    }

    if (!currentUser) return <div>Failed to load identity.</div>;

    const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';

    return (
        <>
            {showSettings && <SettingsModal
                currentUser={currentUser}
                onClose={() => {
                    setShowSettings(false);
                    setMissingKeyWarning(false);
                }}
            />}

            {/* Course Permissions Modal */}
            {courseToManagePermissions && currentUser && (
                <CoursePermissionsModal
                    course={courseToManagePermissions}
                    currentUser={currentUser}
                    onClose={() => setCourseToManagePermissions(null)}
                    onSuccess={handlePermissionsSuccess}
                />
            )}

            {/* User Login/Signup Modal */}
            {showUserAuthModal && (
                <AuthModal
                    onClose={() => setShowUserAuthModal(false)}
                    onSuccess={handleUserAuthSuccess}
                />
            )}

            {/* Teacher Auth Modal */}
            {showTeacherAuthModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Lock size={16} className="text-blue-600" /> 教师身份验证
                            </h3>
                            <button onClick={() => setShowTeacherAuthModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleAuthSubmit} className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
                                <input
                                    type="text"
                                    value={authUsername}
                                    onChange={(e) => setAuthUsername(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="请输入用户名（如 admin 或 teacher）"
                                    autoComplete="username"
                                />
                            </div>
                            <div className="mb-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
                                <input
                                    ref={authInputRef}
                                    type="password"
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none tracking-widest"
                                    placeholder="••••••"
                                />
                            </div>
                            <div className="mt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowTeacherAuthModal(false)}
                                    className="flex-1 py-2.5 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md transition-colors"
                                >
                                    确认进入
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 核心修复：API Key Warning Banner - 严格限制为教师可见 */}
            {isTeacherOrAdmin && missingKeyWarning && !showSettings && (
                <div className="bg-amber-100 text-amber-800 px-4 py-2 text-sm flex items-center justify-between shadow-sm sticky top-0 z-50">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span>检测到当前使用的 AI 模型 (DeepSeek/Zhipu) 未配置 API Key，功能将无法使用。</span>
                    </div>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="bg-amber-600 text-white px-3 py-1 rounded text-xs hover:bg-amber-700 font-medium"
                    >
                        去配置
                    </button>
                </div>
            )}

            {view === 'CREATE_COURSE' ? (
                <CourseCreator
                    initialCourse={courseToEdit}
                    currentUser={currentUser}
                    onBack={() => {
                        setCourseToEdit(null);
                        setView('DASHBOARD');
                    }}
                    onSave={handleCourseSaved}
                />
            ) : view === 'LEARN_COURSE' && activeCourse ? (
                <CourseLearner
                    course={activeCourse}
                    currentUser={currentUser}
                    onExit={() => {
                        setActiveCourse(null);
                        setView('DASHBOARD');
                    }}
                />
            ) : (
                <Dashboard
                    courses={courses}
                    currentUser={currentUser}
                    onSelectCourse={handleSelectCourse}
                    onCreateCourse={handleCreateCourse}
                    onEditCourse={handleEditCourse}
                    onDeleteCourse={handleDeleteCourse}
                    onToggleVisibility={handleToggleVisibility}
                    onManagePermissions={handleManagePermissions}
                    onTeacherToggle={handleTeacherToggle}
                    onOpenSettings={() => setShowSettings(true)}
                    onRefresh={handleRefreshData}
                    onLogin={() => setShowUserAuthModal(true)}
                    onLogout={handleUserLogout}
                />
            )}
        </>
    );
};

export default App;
