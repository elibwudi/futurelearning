
import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, CheckCircle, RotateCcw, Award, ArrowRight, AlertTriangle, Settings, ChevronRight, Edit3, Save, X, Video, Upload, RefreshCw } from 'lucide-react';
import { GraphNode, NodeStatus, QuizQuestion, User } from '../types';
import { generateLessonContent, generateQuizSession, chatWithTutor, updateQuizQuestion } from '../services/geminiService';
import { saveCachedContent } from '../services/storageService';
import RichTextEditor from './RichTextEditor';
import { marked } from 'marked';
import '../styles/richtext.css';

interface LearningPanelProps {
    courseId: string;
    node: GraphNode;
    status: NodeStatus;
    rawText: string;
    currentUser: User;
    onComplete: (success: boolean) => void;
    onOpenSettings?: () => void;
    onNodeUpdate?: (updatedNode: GraphNode) => void;
    canEdit?: boolean;
}

const LearningPanel: React.FC<LearningPanelProps> = ({ courseId, node, status, rawText, onComplete, onOpenSettings, onNodeUpdate, canEdit, currentUser }) => {
    const [activeTab, setActiveTab] = useState<'learn' | 'quiz' | 'video'>('learn');
    const [content, setContent] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [updateKey, setUpdateKey] = useState(0);

    // Quiz Editing
    const [isEditingQuiz, setIsEditingQuiz] = useState(false);
    const [editQuizQ, setEditQuizQ] = useState<QuizQuestion | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [longLoading, setLongLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Quiz State
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [answerSubmitted, setAnswerSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    // Chat State
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: string, text: string }[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Effect to load content when node changes
    useEffect(() => {
        let isMounted = true;
        const loadContent = async () => {
            setLoading(true);
            setLongLoading(false);
            setError(null);
            // Don't reset tab if we just switched node and node has video, 
            // but for now default to 'learn' is safe.
            // If the user was on 'video' tab, maybe we should stay? 
            // Let's reset to 'learn' to be safe.
            if (activeTab !== 'video') setActiveTab('learn');

            setIsEditing(false);
            setIsEditingQuiz(false);
            resetQuizState();
            setChatHistory([]);

            const timer = setTimeout(() => {
                if (isMounted) setLongLoading(true);
            }, 3000);

            try {
                const isRemediation = status === NodeStatus.REMEDIATION;
                const lesson = await generateLessonContent(courseId, node.id, node.label, rawText, isRemediation);

                if (isMounted) {
                    setContent(lesson);
                    // Initial chat message
                    setChatHistory([{
                        role: 'model',
                        text: `你好！我是你的AI导师。为了帮你掌握“${node.label}”，请先阅读上面的讲解，有任何问题都可以问我！`
                    }]);
                }

            } catch (err: any) {
                if (isMounted) {
                    console.error(err);
                    setError(err.message || "加载课程内容出错");
                }
            } finally {
                clearTimeout(timer);
                if (isMounted) setLoading(false);
            }
        };

        loadContent();
        return () => { isMounted = false; };
    }, [courseId, node.id]); // trigger when node ID changes

    const handleRegenerateLesson = async () => {
        if (!window.confirm("确定要重新生成当前知识点的讲义吗？这将覆盖现有内容。")) return;
        setLoading(true);
        setLongLoading(false);
        setError(null);
        setIsEditing(false);

        const timer = setTimeout(() => setLongLoading(true), 3000);

        try {
            const isRemediation = status === NodeStatus.REMEDIATION;
            const lesson = await generateLessonContent(courseId, node.id, node.label, rawText, isRemediation, true);
            setContent(lesson);
            // Refresh chat as well
            setChatHistory([{
                role: 'model',
                text: `讲义已重新生成！我是你的AI导师，对新内容有什么疑问吗？`
            }]);
        } catch (err: any) {
            console.error(err);
            alert("重新生成讲义失败: " + (err.message || "未知错误"));
        } finally {
            clearTimeout(timer);
            setLoading(false);
        }
    };

    const handleRegenerateQuiz = async () => {
        if (!window.confirm("确定要重新生成该知识点的整套题库吗？")) return;
        setLoading(true);
        setError(null);
        resetQuizState();
        try {
            const questions = await generateQuizSession(courseId, node.id, node.label, content || rawText, true);
            setQuizQuestions(questions);
            alert("题库已重新生成！");
        } catch (e: any) {
            alert("无法重新生成题库: " + (e.message || "未知错误"));
        } finally {
            setLoading(false);
        }
    };

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const resetQuizState = () => {
        setQuizQuestions([]);
        setCurrentQuestionIndex(0);
        setScore(0);
        setQuizFinished(false);
        setSelectedOption(null);
        setAnswerSubmitted(false);
    }

    const handleVideoUpload = async (file: File) => {
        if (!file || !onNodeUpdate) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem('cognitive_map_jwt_token');
            const res = await fetch('/api/upload/video', {
                method: 'POST',
                headers: token ? {
                    'Authorization': `Bearer ${token}`
                } : {},
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json();
            if (data.url) {
                // Construct updated node
                const updatedNode = { ...node, videoUrl: data.url };
                // Call parent handler to save and update state
                onNodeUpdate(updatedNode);
                setActiveTab('video'); // Switch to video tab
                alert("视频上传成功！");
            }
        } catch (e) {
            console.error(e);
            alert("上传失败，请重试。");
        } finally {
            setUploading(false);
        }
    };

    const handleStartQuiz = async () => {
        setLoading(true);
        setError(null);
        resetQuizState();
        try {
            // Generate a session of 3 random questions from the pool
            const questions = await generateQuizSession(courseId, node.id, node.label, content || rawText);
            setQuizQuestions(questions);
            setActiveTab('quiz');
        } catch (e: any) {
            alert("无法生成测验: " + (e.message || "未知错误"));
        } finally {
            setLoading(false);
        }
    };

    const submitAnswer = () => {
        if (selectedOption === null) return;
        setAnswerSubmitted(true);

        const currentQ = quizQuestions[currentQuestionIndex];
        if (selectedOption === currentQ.correctOptionIndex) {
            setScore(prev => prev + 1);
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setAnswerSubmitted(false);
        } else {
            setQuizFinished(true);
        }
    };

    const handleFinishQuiz = () => {
        // Pass only if ALL questions are correct (Score == 3)
        const passed = score === quizQuestions.length;
        onComplete(passed);
    };

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setChatInput('');

        const newHistory = [...chatHistory, { role: 'user', text: userMsg }];
        setChatHistory(newHistory);

        const apiHistory = newHistory.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));

        try {
            const response = await chatWithTutor(apiHistory, userMsg);
            setChatHistory(prev => [...prev, { role: 'model', text: response }]);
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'model', text: "网络连接似乎出了点问题。" }]);
        }
    };

    const handleRetry = () => {
        window.location.reload();
    };

    const handleSaveEdit = async () => {
        if (!editContent.trim()) return;
        try {
            const type = status === NodeStatus.REMEDIATION ? 'remediation' : 'lesson';
            await saveCachedContent(courseId, node.id, type, editContent, currentUser.id, currentUser.role);
            setContent(editContent);
            setUpdateKey(prev => prev + 1);
            setIsEditing(false);
        } catch (e) {
            alert("保存失败，请重试");
        }
    };

    const toggleMsgs = () => {
        if (!isEditing) {
            setEditContent(content);
            setIsEditing(true);
        } else {
            setIsEditing(false);
        }
    };

    const handleEditQuizClick = (q: QuizQuestion) => {
        setEditQuizQ({ ...q });
        setIsEditingQuiz(true);
    };

    const handleSaveQuizEdit = async () => {
        if (!editQuizQ) return;
        try {
            await updateQuizQuestion(courseId, node.id, editQuizQ);
            // Update local state
            setQuizQuestions(prev => prev.map(q => q.id === editQuizQ.id ? editQuizQ : q));
            setIsEditingQuiz(false);
            setEditQuizQ(null);
        } catch (e) {
            alert("保存题目失败");
        }
    };

    if (loading && quizQuestions.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="font-medium text-slate-600">正在准备内容...</p>
                <p className="text-xs text-slate-400 mt-2">
                    {longLoading ? "正在使用 AI 生成题库（初次可能较慢）..." : "正在从数据库提取..."}
                </p>
            </div>
        );
    }

    // --- QUIZ VIEW ---
    if (activeTab === 'quiz' && quizQuestions.length > 0) {
        if (quizFinished) {
            const passed = score === quizQuestions.length;
            return (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-white">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${passed ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                        {passed ? <Award size={40} /> : <RotateCcw size={40} />}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">
                        {passed ? "挑战成功！" : "还需要努力"}
                    </h3>
                    <p className="text-slate-500 mb-6">
                        你答对了 {score} / {quizQuestions.length} 道题目
                        {!passed && "。必须全部答对才能掌握此知识点。"}
                    </p>

                    {passed ? (
                        <button
                            onClick={handleFinishQuiz}
                            className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-lg shadow-green-500/30 transition-all"
                        >
                            标记为已掌握
                        </button>
                    ) : (
                        <div className="space-y-3 w-full max-w-xs">
                            <button
                                onClick={handleStartQuiz}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md"
                            >
                                重新抽取题目测验
                            </button>
                            <button
                                onClick={() => setActiveTab('learn')}
                                className="w-full py-3 bg-white border border-slate-300 text-slate-600 rounded-lg font-medium hover:bg-slate-50"
                            >
                                返回复习
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        const currentQ = quizQuestions[currentQuestionIndex];
        const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;
        const isCorrect = selectedOption === currentQ.correctOptionIndex;

        return (
            <div className="h-full flex flex-col bg-slate-50">
                {/* Quiz Header */}
                <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-500">
                        问题 {currentQuestionIndex + 1} / {quizQuestions.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded border ${currentQ.difficulty === 'Easy' ? 'bg-green-50 text-green-600 border-green-200' :
                            currentQ.difficulty === 'Medium' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                'bg-red-50 text-red-600 border-red-200'
                            }`}>
                            {currentQ.difficulty === 'Easy' ? '简单' : currentQ.difficulty === 'Medium' ? '中等' : '困难'}
                        </span>
                        {canEdit && activeTab === 'quiz' && !loading && !error && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleRegenerateQuiz}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-full hover:bg-slate-100 transition-colors"
                                    title="重新生成并抽取题目"
                                >
                                    <RefreshCw size={14} />
                                </button>
                                <button
                                    onClick={() => handleEditQuizClick(currentQ)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-full hover:bg-slate-100 transition-colors"
                                    title="编辑题目"
                                >
                                    <Edit3 size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Question Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isEditingQuiz && editQuizQ && editQuizQ.id === currentQ.id ? (
                        <div className="bg-white p-4 border border-blue-200 rounded-lg shadow-sm space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">题目描述</label>
                                <textarea
                                    value={editQuizQ.question}
                                    onChange={(e) => setEditQuizQ({ ...editQuizQ, question: e.target.value })}
                                    className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">选项 (A, B, C, D)</label>
                                {editQuizQ.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2 mb-2">
                                        <span className="w-4 text-xs font-bold text-slate-400">{String.fromCharCode(65 + idx)}</span>
                                        <input
                                            value={opt}
                                            onChange={(e) => {
                                                const newOpts = [...editQuizQ.options];
                                                newOpts[idx] = e.target.value;
                                                setEditQuizQ({ ...editQuizQ, options: newOpts });
                                            }}
                                            className="flex-1 text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <input
                                            type="radio"
                                            name="correctOpt"
                                            checked={editQuizQ.correctOptionIndex === idx}
                                            onChange={() => setEditQuizQ({ ...editQuizQ, correctOptionIndex: idx })}
                                            title="设为正确答案"
                                            className="accent-green-600 cursor-pointer w-4 h-4"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">解析 / 反馈</label>
                                <textarea
                                    value={editQuizQ.explanation}
                                    onChange={(e) => setEditQuizQ({ ...editQuizQ, explanation: e.target.value })}
                                    className="w-full text-sm p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={2}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setIsEditingQuiz(false)}
                                    className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSaveQuizEdit}
                                    className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm"
                                >
                                    保存修改
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-lg font-semibold text-slate-800 mb-6 leading-relaxed">
                                {currentQ.question}
                            </h3>

                            <div className="space-y-3">
                                {currentQ.options.map((option, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => !answerSubmitted && setSelectedOption(idx)}
                                        disabled={answerSubmitted}
                                        className={`w-full text-left p-4 rounded-xl border transition-all relative ${answerSubmitted
                                            ? idx === currentQ.correctOptionIndex
                                                ? 'bg-green-50 border-green-500 ring-1 ring-green-500'
                                                : idx === selectedOption
                                                    ? 'bg-red-50 border-red-500 ring-1 ring-red-500'
                                                    : 'bg-white border-slate-200 opacity-60'
                                            : selectedOption === idx
                                                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                                                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span className="font-bold text-slate-400 mr-3">{String.fromCharCode(65 + idx)}.</span>
                                        <span className="text-slate-700">{option}</span>
                                        {answerSubmitted && idx === currentQ.correctOptionIndex && (
                                            <CheckCircle size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {answerSubmitted && !isEditingQuiz && (
                        <div className={`mt-6 p-4 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} animate-in fade-in slide-in-from-bottom-2`}>
                            <div className="flex items-center gap-2 font-bold mb-1">
                                {isCorrect ? <span className="text-green-700">回答正确</span> : <span className="text-red-700">回答错误</span>}
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{currentQ.explanation}</p>
                        </div>
                    )}
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-white border-t border-slate-200">
                    {!answerSubmitted ? (
                        <button
                            onClick={submitAnswer}
                            disabled={selectedOption === null}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            提交答案
                        </button>
                    ) : (
                        <button
                            onClick={handleNextQuestion}
                            className="w-full py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 flex items-center justify-center gap-2 transition-colors"
                        >
                            {isLastQuestion ? "查看结果" : "下一题"} <ChevronRight size={18} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --- LEARN VIEW ---
    return (
        <div className="h-full flex flex-col bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 relative">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 mb-1 uppercase tracking-wide">
                    {status === NodeStatus.REMEDIATION && <span className="text-amber-500 flex items-center gap-1"><RotateCcw size={14} /> 补习模式</span>}
                    {status === NodeStatus.MASTERED && <span className="text-green-500 flex items-center gap-1"><Award size={14} /> 已掌握</span>}
                    {status === NodeStatus.AVAILABLE || status === NodeStatus.LEARNING ? "学习模式" : ""}
                </div>
                <h2 className="text-2xl font-bold text-slate-800 pr-12">{node.label}</h2>
                <p className="text-slate-500 text-sm mt-1">{node.description}</p>

                {canEdit && activeTab === 'learn' && !loading && !error && (
                    <div className="absolute top-6 right-6 flex gap-2">
                        {/* Video Upload Button in Header (Optional quick access) */}
                        <label className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded-full shadow-sm cursor-pointer transition-colors" title="上传/替换视屏">
                            {uploading ? <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" /> : <Video size={18} />}
                            <input
                                type="file"
                                accept="video/*"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) handleVideoUpload(e.target.files[0]);
                                }}
                            />
                        </label>

                        {isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-full shadow-sm"
                                    title="取消"
                                >
                                    <X size={18} />
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="p-2 text-white bg-green-600 hover:bg-green-700 rounded-full shadow-sm"
                                    title="保存"
                                >
                                    <Save size={18} />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleRegenerateLesson}
                                    className="p-2 text-slate-400 hover:text-emerald-600 bg-white border border-slate-200 rounded-full shadow-sm transition-colors"
                                    title="重新生成讲义"
                                >
                                    <RefreshCw size={18} />
                                </button>
                                <button
                                    onClick={toggleMsgs}
                                    className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded-full shadow-sm transition-colors"
                                    title="编辑内容"
                                >
                                    <Edit3 size={18} />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100">
                <button
                    onClick={() => setActiveTab('learn')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'learn' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <BookOpen size={16} /> 学习 & 对话
                </button>
                {node.videoUrl && (
                    <button
                        onClick={() => setActiveTab('video')}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'video' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Video size={16} /> 视频课堂
                    </button>
                )}
                <button
                    onClick={() => {
                        if (status === NodeStatus.MASTERED && quizQuestions.length === 0) {
                            handleStartQuiz();
                        } else {
                            setActiveTab('quiz');
                            if (quizQuestions.length === 0) handleStartQuiz();
                        }
                    }}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'quiz' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <CheckCircle size={16} /> 测验
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
                {error ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-500 p-4 text-center">
                        <AlertTriangle size={32} className="mb-2 opacity-50" />
                        <p className="font-bold mb-1">加载失败</p>
                        <p className="text-sm text-red-400 mb-4">{error}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRetry}
                                className="text-xs bg-red-50 px-3 py-1.5 rounded border border-red-100 hover:bg-red-100 text-red-600 font-medium"
                            >
                                重试
                            </button>
                            {onOpenSettings && (
                                <button
                                    onClick={onOpenSettings}
                                    className="text-xs bg-slate-50 px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium flex items-center gap-1"
                                >
                                    <Settings size={12} /> 打开设置
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {/* AI Generated Lesson or Video */}
                        {activeTab === 'video' ? (
                            <div className="h-full flex flex-col gap-4">
                                <div className="bg-slate-900 rounded-lg overflow-hidden shadow-lg flex-1 flex items-center justify-center relative group">
                                    <video
                                        src={node.videoUrl}
                                        controls
                                        className="max-w-full max-h-full w-full h-full"
                                        controlsList="nodownload"
                                        onError={(e) => {
                                            const target = e.target as HTMLVideoElement;
                                            target.poster = ""; // Clear potential poster
                                            // We could show a visual error overlay here if needed
                                            alert("无法加载视频。可能是格式不支持或网络问题。");
                                        }}
                                    >
                                        您的浏览器不支持视频播放。
                                    </video>
                                </div>
                                <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm flex justify-between items-center">
                                    <div>
                                        <p className="font-bold flex items-center gap-2 mb-1"><Video size={16} /> 视频学习模式</p>
                                        <p>观看视频讲解，结合文本内容加深理解。看完后记得进行测验哦！</p>
                                    </div>
                                    {canEdit && (
                                        <label className="cursor-pointer bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors flex items-center gap-1">
                                            <Upload size={14} /> 更换视频
                                            <input
                                                type="file"
                                                accept="video/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) handleVideoUpload(e.target.files[0]);
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                {isEditing ? (
                                    <RichTextEditor
                                        value={editContent}
                                        onChange={setEditContent}
                                        placeholder="开始编辑内容..."
                                    />
                                ) : (
                                    <div className="prose prose-slate prose-sm max-w-none">
                                        <div key={updateKey} dangerouslySetInnerHTML={{ 
                                            __html: (() => {
                                                if (!content) return '';
                                                try {
                                                    // Use marked to parse markdown reliably with breaks enabled
                                                    return marked.parse(content, { breaks: true }) as string;
                                                } catch (e) {
                                                    console.error("Markdown parsing failed", e);
                                                    return content;
                                                }
                                            })()
                                        }} />
                                    </div>
                                )}

                                <hr className="border-slate-100" />

                                {/* Chat Interface */}
                                <div className="flex-1 flex flex-col min-h-[300px] bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="flex-1 p-4 overflow-y-auto space-y-3">
                                        {chatHistory.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                                                    {msg.text}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                    <form onSubmit={handleChatSubmit} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="输入您的问题..."
                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button type="submit" className="bg-slate-800 text-white p-2 rounded-md hover:bg-slate-700">
                                            <ArrowRight size={16} />
                                        </button>
                                    </form>
                                </div>

                                <button
                                    onClick={handleStartQuiz}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm mt-auto"
                                >
                                    开始测验 (需答对 3/3 题)
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LearningPanel;
