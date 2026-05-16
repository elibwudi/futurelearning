
import React, { useState, useRef, useEffect } from 'react';
import { generateGraphFromText, generateLessonContent, generateQuizSession } from '../services/geminiService';
import { extractTextFromPdf } from '../services/pdfService';
import { saveCourse } from '../services/storageService';
import ForceGraph from './ForceGraph';
import { User, Course, GraphNode, GraphEdge, KnowledgeGraphData } from '../types';
import { Sparkles, Upload, FileText, Save, ArrowLeft, X, Plus, Trash2, Edit2, Network, GripHorizontal, MousePointerClick, Code, Bot, Copy, Check, Zap, Loader2, Video as VideoIcon } from 'lucide-react';

interface CourseCreatorProps {
    initialCourse?: Course | null;
    currentUser: User;
    onBack: () => void;
    onSave: () => void;
}

type TabMode = 'SOURCE' | 'EDITOR';
type EditorTab = 'NODES' | 'EDGES';
type GenerationMode = 'AUTO' | 'MANUAL';

const CourseCreator: React.FC<CourseCreatorProps> = ({ initialCourse, currentUser, onBack, onSave }) => {
    const [activeTab, setActiveTab] = useState<TabMode>('SOURCE');

    // Content State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [inputText, setInputText] = useState('');

    // Generation Mode
    const [genMode, setGenMode] = useState<GenerationMode>('AUTO');
    const [manualJson, setManualJson] = useState('');

    // Graph State
    const [graphData, setGraphData] = useState<KnowledgeGraphData>({ nodes: [], edges: [] });

    // Editor State
    const [editorSubTab, setEditorSubTab] = useState<EditorTab>('NODES');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Loading States
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [copied, setCopied] = useState(false);

    // Permission: Can edit graph structure?
    const canEditGraph = !initialCourse || initialCourse.permissionLevel === 'owner' || !initialCourse.permissionLevel;

    // Batch Init State
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentNode: '' });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const nodeRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Initialize if editing existing course
    useEffect(() => {
        if (initialCourse) {
            setTitle(initialCourse.title);
            setDescription(initialCourse.description);
            setInputText(initialCourse.rawText || '');
            setGraphData(initialCourse.graphData);
            setActiveTab('EDITOR'); // Jump straight to editor for existing courses
        }
    }, [initialCourse]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert("请上传有效的 PDF 文件。");
            return;
        }

        setIsExtracting(true);
        // Auto-fill title if empty
        if (!title) setTitle(file.name.replace('.pdf', ''));

        try {
            const text = await extractTextFromPdf(file);
            setInputText(text);
        } catch (error) {
            console.error(error);
            alert("读取 PDF 失败。请确保文件未加密。");
        } finally {
            setIsExtracting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleGenerateGraph = async () => {
        if (!inputText.trim()) return;
        setLoading(true);
        try {
            const data = await generateGraphFromText(inputText);
            setGraphData(data);
            setActiveTab('EDITOR'); // Automatically switch to editor on success
        } catch (error: any) {
            console.error(error);
            const msg = error.message || "未知错误";
            alert(`生成图谱失败: ${msg}\n\n可能原因：\n1. API Key 未配置或无效。\n2. 网络连接问题（Google API 无法访问）。\n3. 文本过长导致超时。`);
        } finally {
            setLoading(false);
        }
    };

    const handleManualParse = () => {
        if (!manualJson.trim()) {
            alert("请输入 JSON 内容");
            return;
        }
        try {
            const parsed = JSON.parse(manualJson);
            if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
                throw new Error("JSON 格式错误：必须包含 nodes 和 edges 数组。");
            }
            if (parsed.nodes.length > 0 && (!parsed.nodes[0].id || !parsed.nodes[0].label)) {
                throw new Error("节点缺少 id 或 label 属性。");
            }
            setGraphData(parsed);
            setActiveTab('EDITOR');
        } catch (e: any) {
            alert("解析 JSON 失败: " + e.message);
        }
    };

    const copyPromptToClipboard = () => {
        const prompt = `请分析教材内容，构建知识图谱。必须返回严格的纯 JSON 格式（不要 Markdown 代码块），包含 "nodes" (id, label, description) 和 "edges" (source, target, relationship) 两个数组。确保生成 30-40 个核心概念节点。`;
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Normal Save Handler (Manual Click)
    const handleSaveCourse = async (markAsReady: boolean = false) => {
        if (!graphData.nodes.length || !title) return;

        if (!inputText.trim()) {
            alert("请确保您已上传 PDF 或输入了教材文本内容。后续 AI 教学需要依赖这些原始文本。");
            return;
        }

        setSaving(true);

        const id = initialCourse ? initialCourse.id : 'c' + Date.now();
        const createdAt = initialCourse ? initialCourse.createdAt : Date.now();
        const currentStatus = markAsReady ? 'ready' : (initialCourse?.status || 'draft');

        const newCourse: Course = {
            id,
            title,
            description: description || '无描述',
            rawText: inputText,
            graphData: graphData,
            createdAt,
            status: currentStatus
        };

        try {
            await saveCourse(newCourse, currentUser.id, currentUser.role);
            // Logic: If it's a manual save (not ready), we exit.
            // If it's "Ready", we usually also exit, but this function is only called by the button now.
            if (!markAsReady) onSave();
            else onSave(); // Exit on ready save too if clicked manually
        } catch (e) {
            console.error(e);
            alert(`保存失败：${e.message || "未知错误"}`);
        } finally {
            setSaving(false);
        }
    };

    // Batch Initialization Logic (FIXED: Decoupled from handleSaveCourse to prevent premature exit)
    const handleOneClickInit = async () => {
        if (!inputText.trim()) {
            alert("无法初始化：缺少教材原文内容。");
            return;
        }
        if (graphData.nodes.length === 0) return;
        if (!window.confirm(`即将为 ${graphData.nodes.length} 个知识点生成讲义和题库。\n\n这可能需要几分钟时间，请勿关闭页面。\n\n确认开始吗？`)) return;

        setIsBatchProcessing(true);

        // Determine IDs once
        const courseId = initialCourse ? initialCourse.id : 'c' + Date.now();
        const createdAt = initialCourse ? initialCourse.createdAt : Date.now();

        try {
            // 1. Manually Save Draft FIRST (Without exiting)
            // We construct the object directly to avoid calling handleSaveCourse's navigation logic
            const draftCourse: Course = {
                id: courseId,
                title,
                description: description || '无描述',
                rawText: inputText,
                graphData: graphData,
                createdAt,
                status: 'draft'
            };
            await saveCourse(draftCourse, currentUser.id, currentUser.role); // Save to DB

            // 2. Iterate nodes and generate content
            let count = 0;
            for (const node of graphData.nodes) {
                count++;
                setBatchProgress({ current: count, total: graphData.nodes.length, currentNode: node.label });

                try {
                    // A. Generate Lesson Content (Cached automatically)
                    await generateLessonContent(courseId, node.id, node.label, inputText, false);

                    // B. Generate Quiz Pool (Cached automatically)
                    await generateQuizSession(courseId, node.id, node.label, inputText);
                } catch (nodeError: any) {
                    console.error(`节点 "${node.label}" 生成失败:`, nodeError);
                    const shouldContinue = window.confirm(
                        `节点 "${node.label}" 生成失败：\n\n${nodeError.message}\n\n是否继续处理其他节点？`
                    );
                    if (!shouldContinue) {
                        throw new Error(`用户在节点 "${node.label}" 处中止了批量生成`);
                    }
                }
            }

            // 3. Save as READY (Without exiting yet)
            const readyCourse = { ...draftCourse, status: 'ready' as const };
            await saveCourse(readyCourse, currentUser.id, currentUser.role);

            // 4. Success & Exit
            alert("🎉 全课内容初始化完成！\n\n所有知识点的讲义和题库已生成完毕。");
            onSave(); // NOW we exit explicitly

        } catch (e: any) {
            console.error(e);
            alert("初始化过程中断: " + e.message);
            // Do NOT exit here, so user can see what happened
        } finally {
            setIsBatchProcessing(false);
        }
    };

    // Node Video Upload
    const handleNodeVideoUpload = async (file: File, nodeId: string) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('cognitive_map_jwt_token');
            const res = await fetch('/api/upload/video', {
                method: 'POST',
                headers: token ? {
                    'Authorization': `Bearer ${token}`
                } : {},
                body: formData
            });
            const data = await res.json();
            if (data.url) {
                updateNode(nodeId, 'videoUrl', data.url);
            } else {
                alert("上传失败");
            }
        } catch (e) {
            console.error(e);
            alert("上传出错");
        }
    };

    // --- Graph Editing Functions ---

    const addNode = () => {
        const id = `node_${Date.now()}`;
        const newNode: GraphNode = {
            id,
            label: '新节点',
            description: '请输入描述...'
        };
        setGraphData(prev => ({ ...prev, nodes: [...prev.nodes, newNode] }));
        setSelectedNodeId(id);
        setTimeout(() => {
            nodeRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const updateNode = (id: string, field: keyof GraphNode, value: string) => {
        setGraphData(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => n.id === id ? { ...n, [field]: value } : n)
        }));
    };

    const deleteNode = (id: string) => {
        if (!window.confirm("确定删除此节点吗？相关连线也会被删除。")) return;
        setGraphData(prev => ({
            nodes: prev.nodes.filter(n => n.id !== id),
            edges: prev.edges.filter(e => {
                const sourceId = typeof e.source === 'object' ? (e.source as any).id : e.source;
                const targetId = typeof e.target === 'object' ? (e.target as any).id : e.target;
                return sourceId !== id && targetId !== id;
            })
        }));
        if (selectedNodeId === id) setSelectedNodeId(null);
    };

    const addEdge = () => {
        if (graphData.nodes.length < 2) return;
        const newEdge: GraphEdge = {
            source: graphData.nodes[0].id,
            target: graphData.nodes[1].id,
            relationship: '关联'
        };
        setGraphData(prev => ({ ...prev, edges: [...prev.edges, newEdge] }));
    };

    const updateEdge = (index: number, field: keyof GraphEdge, value: string) => {
        setGraphData(prev => {
            const newEdges = [...prev.edges];
            newEdges[index] = { ...newEdges[index], [field]: value };
            return { ...prev, edges: newEdges };
        });
    };

    const deleteEdge = (index: number) => {
        setGraphData(prev => ({ ...prev, edges: prev.edges.filter((_, i) => i !== index) }));
    };

    const handleGraphNodeClick = (node: GraphNode) => {
        setEditorSubTab('NODES');
        setSelectedNodeId(node.id);
        setTimeout(() => {
            nodeRefs.current[node.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
    };

    return (
        <div className="h-screen flex flex-col bg-white relative">
            {/* Batch Processing Overlay */}
            {isBatchProcessing && (
                <div className="fixed inset-0 bg-white/90 backdrop-blur z-50 flex items-center justify-center p-8 cursor-wait">
                    <div className="w-full max-w-lg text-center">
                        <div className="mx-auto mb-6 w-20 h-20 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                            <Bot size={32} className="absolute inset-0 m-auto text-emerald-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">正在初始化全课内容</h3>
                        <p className="text-slate-500 mb-8">AI 正在为每个知识点生成讲义和题库，请稍候...</p>

                        <div className="bg-slate-100 rounded-full h-4 overflow-hidden mb-2 relative">
                            <div
                                className="bg-emerald-500 h-full transition-all duration-300 relative"
                                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" />
                            </div>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-emerald-600 truncate max-w-[200px]">{batchProgress.currentNode}</span>
                            <span className="text-slate-400">{batchProgress.current} / {batchProgress.total}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="h-16 border-b border-slate-200 px-6 flex items-center justify-between shrink-0 bg-white z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">
                            {initialCourse ? "编辑课程" : "创建新课程"}
                        </h1>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                            <button
                                onClick={() => setActiveTab('SOURCE')}
                                className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${activeTab === 'SOURCE' ? 'text-blue-600 font-medium' : 'hover:text-slate-600'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${activeTab === 'SOURCE' ? 'bg-blue-500' : 'bg-slate-300'}`}></span> 1. 上传内容
                            </button>
                            <span className="text-slate-300">/</span>
                            <button
                                onClick={() => setActiveTab('EDITOR')}
                                disabled={graphData.nodes.length === 0}
                                className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${activeTab === 'EDITOR' ? 'text-blue-600 font-medium' : 'hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                            >
                                <span className={`w-2 h-2 rounded-full ${activeTab === 'EDITOR' ? 'bg-blue-500' : 'bg-slate-300'}`}></span> 2. 调整图谱
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {/* One-Click Init Button */}
                    {activeTab === 'EDITOR' && graphData.nodes.length > 0 && (
                        <button
                            onClick={handleOneClickInit}
                            disabled={saving || isBatchProcessing}
                            className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-100 hover:border-emerald-300 shadow-sm transition-all mr-2"
                            title="自动生成所有节点的讲义和题库"
                        >
                            <Zap size={16} />
                            一键生成全课内容
                        </button>
                    )}

                    <button
                        onClick={() => handleSaveCourse(false)}
                        disabled={!graphData.nodes.length || !title || saving}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm transition-all"
                    >
                        {saving ? <span className="animate-spin w-4 h-4 border-b-2 border-white rounded-full" /> : <Save size={18} />}
                        保存{initialCourse ? "修改" : "并发布"}
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* LEFT PANEL */}
                <div className="w-[450px] bg-slate-50 border-r border-slate-200 flex flex-col shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10">

                    {/* TAB: SOURCE INPUT */}
                    {activeTab === 'SOURCE' && (
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 animate-in slide-in-from-left duration-300">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">课程标题</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder="例如：高中生物必修一"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">课程简介</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-16"
                                        placeholder="简要描述课程目标..."
                                    />
                                </div>
                            </div>
                            <hr className="border-slate-200" />
                            {/* Content Source */}
                            <div className="space-y-2 flex-col flex h-48 shrink-0">
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-medium text-slate-700">教材内容 (AI 教学基础)</label>
                                    <div className="flex gap-2">
                                        <input type="file" ref={fileInputRef} accept="application/pdf" onChange={handleFileUpload} className="hidden" />
                                        <button onClick={() => fileInputRef.current?.click()} disabled={isExtracting || loading} className="text-xs px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1">
                                            {isExtracting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 上传 PDF
                                        </button>
                                        {inputText && <button onClick={() => setInputText('')} className="text-xs px-3 py-1.5 text-slate-400 hover:text-red-500 transition-colors">清空</button>}
                                    </div>
                                </div>
                                <textarea
                                    className="w-full h-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-xs font-mono leading-relaxed bg-white"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="在此粘贴文本或上传 PDF。这部分内容将作为本地 AI 教学的依据。"
                                    disabled={isExtracting}
                                />
                            </div>
                            <hr className="border-slate-200" />
                            {/* Graph Generation */}
                            <div className="flex-1 flex flex-col">
                                <label className="block text-sm font-medium text-slate-700 mb-3">图谱生成方式</label>
                                <div className="flex p-1 bg-slate-200 rounded-lg mb-4">
                                    <button onClick={() => setGenMode('AUTO')} className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${genMode === 'AUTO' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <Bot size={16} /> AI 自动生成
                                    </button>
                                    <button onClick={() => setGenMode('MANUAL')} className={`flex-1 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${genMode === 'MANUAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                        <Code size={16} /> 手工导入 JSON
                                    </button>
                                </div>
                                {genMode === 'AUTO' ? (
                                    <div className="flex-1 flex flex-col justify-end">
                                        <p className="text-xs text-slate-500 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
                                            系统将使用当前配置的 AI 模型（Gemini Cloud 或本地 Ollama）分析上述教材文本并构建图谱。
                                        </p>
                                        <button onClick={handleGenerateGraph} disabled={loading || isExtracting || !inputText} className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all shadow-md ${loading ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                            {loading ? <><Loader2 size={18} className="animate-spin" /> AI 正在分析...</> : <><Sparkles size={18} /> 一键生成预览</>}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500">粘贴 JSON 数据</span>
                                            <button onClick={copyPromptToClipboard} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">{copied ? <Check size={12} /> : <Copy size={12} />} 复制生成提示词</button>
                                        </div>
                                        <textarea className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-xs font-mono bg-slate-800 text-green-400" value={manualJson} onChange={(e) => setManualJson(e.target.value)} placeholder='{ "nodes": [...], "edges": [...] }' />
                                        <button onClick={handleManualParse} className="w-full py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium flex items-center justify-center gap-2"><Code size={16} /> 解析并预览</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: GRAPH EDITOR */}
                    {activeTab === 'EDITOR' && (
                        <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right duration-300">
                            <div className="flex border-b border-slate-200 bg-white">
                                <button onClick={() => setEditorSubTab('NODES')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${editorSubTab === 'NODES' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                                    <GripHorizontal size={16} /> 节点 ({graphData.nodes.length})
                                </button>
                                <button onClick={() => setEditorSubTab('EDGES')} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors ${editorSubTab === 'EDGES' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                                    <Network size={16} /> 连线 ({graphData.edges.length})
                                </button>
                            </div>

                            {editorSubTab === 'NODES' && (
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                                    {!canEditGraph && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-3">
                                            <div className="font-medium mb-1">⚠️ 权限受限</div>
                                            <div>您是课程团队成员，只能编辑知识点内容，无法修改图谱结构（增删节点、修改连线）。</div>
                                        </div>
                                    )}
                                    {graphData.nodes.map(node => (
                                        <div key={node.id} ref={el => { nodeRefs.current[node.id] = el; }} onClick={() => setSelectedNodeId(node.id)} className={`bg-white p-3 rounded-lg border shadow-sm group transition-all cursor-pointer ${selectedNodeId === node.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300'}`}>
                                            <div className="flex items-start gap-2 mb-2">
                                                <div className={`p-1.5 rounded mt-0.5 ${selectedNodeId === node.id ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'}`}><Edit2 size={12} /></div>
                                                <input type="text" value={node.label} onChange={(e) => updateNode(node.id, 'label', e.target.value)} disabled={!canEditGraph} className="flex-1 text-sm font-bold text-slate-800 border-none p-0 focus:ring-0 placeholder-slate-300 disabled:bg-transparent disabled:cursor-not-allowed" placeholder="节点名称" />
                                                <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} disabled={!canEditGraph} className="text-slate-300 hover:text-red-500 p-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <textarea value={node.description} onChange={(e) => updateNode(node.id, 'description', e.target.value)} disabled={!canEditGraph} className="w-full text-xs text-slate-500 border border-slate-100 rounded bg-slate-50 p-2 focus:bg-white focus:border-blue-200 focus:outline-none resize-none disabled:bg-slate-100 disabled:cursor-not-allowed" rows={2} placeholder="节点描述..." />
                                            </div>
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept="video/*"
                                                        className="hidden"
                                                        id={`vid-${node.id}`}
                                                        onChange={(e) => e.target.files?.[0] && handleNodeVideoUpload(e.target.files[0], node.id)}
                                                    />
                                                    <label htmlFor={`vid-${node.id}`} className="cursor-pointer flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors border border-slate-200">
                                                        <VideoIcon size={12} /> {node.videoUrl ? '更换视频' : '上传视频'}
                                                    </label>
                                                </div>
                                                {node.videoUrl && (
                                                    <span className="text-[10px] text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded border border-green-100 truncate max-w-[120px]">
                                                        <Check size={10} /> 已上传
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={addNode} disabled={!canEditGraph} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-medium hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:text-slate-500 disabled:hover:bg-transparent"><Plus size={16} /> 添加节点</button>
                                </div>
                            )}

                            {editorSubTab === 'EDGES' && (
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                                    {!canEditGraph && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-3">
                                            <div className="font-medium mb-1">⚠️ 权限受限</div>
                                            <div>您是课程团队成员，只能编辑知识点内容，无法修改图谱结构（增删节点、修改连线）。</div>
                                        </div>
                                    )}
                                    {graphData.edges.map((edge, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-xs group hover:border-blue-300">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">从 (Source)</label>
                                                    <select value={typeof edge.source === 'object' ? (edge.source as any).id : edge.source} onChange={(e) => updateEdge(idx, 'source', e.target.value)} disabled={!canEditGraph} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:border-blue-300 outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                                                        {graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                                    </select>
                                                </div>
                                                <div className="text-slate-300 pt-4">→</div>
                                                <div className="flex-1">
                                                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">到 (Target)</label>
                                                    <select value={typeof edge.target === 'object' ? (edge.target as any).id : edge.target} onChange={(e) => updateEdge(idx, 'target', e.target.value)} disabled={!canEditGraph} className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 focus:border-blue-300 outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                                                        {graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="text" value={edge.relationship} onChange={(e) => updateEdge(idx, 'relationship', e.target.value)} disabled={!canEditGraph} className="flex-1 bg-transparent border-b border-slate-100 focus:border-blue-300 outline-none py-1 text-slate-600 placeholder-slate-300 disabled:opacity-50 disabled:cursor-not-allowed" placeholder="关系描述 (例如: 包含)" />
                                                <button onClick={() => deleteEdge(idx)} disabled={!canEditGraph} className="text-slate-300 hover:text-red-500 p-1 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={addEdge} disabled={!canEditGraph} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-medium hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-300 disabled:hover:text-slate-500 disabled:hover:bg-transparent"><Plus size={16} /> 添加连线</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT PANEL: PREVIEW */}
                <div className="flex-1 bg-slate-100/50 p-4 relative overflow-hidden">
                    {graphData.nodes.length > 0 ? (
                        <div className="w-full h-full bg-white rounded-xl shadow-inner border border-slate-200 overflow-hidden relative">
                            <ForceGraph nodes={graphData.nodes} edges={graphData.edges} progress={{}} onNodeClick={handleGraphNodeClick} width={800} height={600} />
                            <div className="absolute top-4 left-4 bg-white/90 px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 border border-slate-200 shadow-sm flex items-center gap-2 pointer-events-none">
                                {activeTab === 'EDITOR' ? <><MousePointerClick size={12} className="text-blue-500" /> 点击图谱节点可在左侧进行编辑</> : <><Sparkles size={12} className="text-blue-500" /> 图谱预览</>}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            <div className="p-6 bg-white rounded-full shadow-sm mb-4"><Sparkles size={48} className="text-slate-200" /></div>
                            <p>在左侧上传 PDF 并选择生成方式，在此处预览和调整图谱。</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CourseCreator;
