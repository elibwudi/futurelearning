
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ForceGraph from './ForceGraph';
import LearningPanel from './LearningPanel';
import { Course, User, UserProgress, NodeStatus, GraphNode } from '../types';
import { getUserProgress, saveUserProgress, saveCourse } from '../services/storageService';
import { ArrowLeft, Layout, ChevronRight, Trophy, Sparkles, Target, Zap, Flag } from 'lucide-react';

interface CourseLearnerProps {
    course: Course;
    currentUser: User;
    onExit: () => void;
}

const CourseLearner: React.FC<CourseLearnerProps> = ({ course, currentUser, onExit }) => {
    // Local course state to reflect updates immediately
    const [currentCourse, setCurrentCourse] = useState<Course>(course);
    const [userProgress, setUserProgress] = useState<UserProgress>({});
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // Sync prop changes
    useEffect(() => { setCurrentCourse(course); }, [course]);

    // Calculate Progress Stats
    const totalNodes = course.graphData.nodes.length;
    const masteredCount = Object.values(userProgress).filter((p: any) => p.status === NodeStatus.MASTERED).length;
    const progressPercent = totalNodes > 0 ? Math.round((masteredCount / totalNodes) * 100) : 0;

    // Dynamic Encouragement Message
    const encouragement = useMemo(() => {
        if (progressPercent === 100) return { text: "完美通关！你不仅学完了知识，更战胜了自己！", icon: <Trophy size={14} className="text-yellow-500" /> };
        if (progressPercent >= 90) return { text: "最后的冲刺！顶峰的风景就在眼前！", icon: <Flag size={14} className="text-red-500" /> };
        if (progressPercent >= 75) return { text: "势如破竹！你的进步令人惊叹！", icon: <Zap size={14} className="text-purple-500" /> };
        if (progressPercent >= 50) return { text: "已经过半了！坚持就是胜利！", icon: <Target size={14} className="text-blue-500" /> };
        if (progressPercent >= 25) return { text: "渐入佳境，保持这个节奏！", icon: <Sparkles size={14} className="text-blue-400" /> };
        if (progressPercent > 0) return { text: "很好的开始，每一小步都算数！", icon: <Sparkles size={14} className="text-green-500" /> };
        return { text: "千里之行，始于足下。开启你的探索之旅吧！", icon: <Layout size={14} className="text-slate-400" /> };
    }, [progressPercent]);

    // Load progress on mount
    useEffect(() => {
        const load = async () => {
            const loadedProgress = await getUserProgress(currentUser.id, course.id);

            // Calculate initial unlock status based on graph dependencies
            // If progress is empty, unlock root nodes
            const computedProgress = { ...loadedProgress };
            let hasChanges = false;

            // Logic: Find nodes with NO incoming edges (Roots) and mark them AVAILABLE if not already set
            const targets = new Set(course.graphData.edges.map(e => typeof e.target === 'object' ? (e.target as any).id : e.target));

            course.graphData.nodes.forEach(node => {
                // If node has no status record
                if (!computedProgress[node.id]) {
                    const isRoot = !targets.has(node.id);
                    computedProgress[node.id] = {
                        status: isRoot ? NodeStatus.AVAILABLE : NodeStatus.LOCKED,
                        attempts: 0
                    };
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                await saveUserProgress(currentUser.id, course.id, computedProgress);
            }
            setUserProgress(computedProgress);
        };
        load();
    }, [course, currentUser.id]);

    const updateNodeStatus = useCallback(async (nodeId: string, newStatus: NodeStatus) => {
        // Optimistic update
        let nextState = { ...userProgress };

        setUserProgress(prev => {
            const next = { ...prev };
            if (!next[nodeId]) next[nodeId] = { status: NodeStatus.LOCKED, attempts: 0 };
            next[nodeId] = { ...next[nodeId], status: newStatus };

            // If mastered, check dependents
            if (newStatus === NodeStatus.MASTERED) {
                // Find all nodes where 'nodeId' is a source
                const dependentEdges = course.graphData.edges.filter(e =>
                    (typeof e.source === 'object' ? (e.source as any).id : e.source) === nodeId
                );

                dependentEdges.forEach(edge => {
                    const targetId = typeof edge.target === 'object' ? (edge.target as any).id : edge.target;

                    // Check if ALL prerequisites for this target are met
                    const allPrereqs = course.graphData.edges.filter(e =>
                        (typeof e.target === 'object' ? (e.target as any).id : e.target) === targetId
                    );

                    const allMastered = allPrereqs.every(prereq => {
                        const srcId = typeof prereq.source === 'object' ? (prereq.source as any).id : prereq.source;
                        // Check 'next' state for accuracy
                        return srcId === nodeId ? true : next[srcId]?.status === NodeStatus.MASTERED;
                    });

                    if (allMastered && next[targetId].status === NodeStatus.LOCKED) {
                        next[targetId].status = NodeStatus.AVAILABLE;
                    }
                });
            }
            nextState = next;
            return next;
        });

        // PERSIST CHANGE
        await saveUserProgress(currentUser.id, course.id, nextState);
    }, [course, currentUser.id, userProgress]);

    const handleNodeClick = (node: GraphNode) => {
        const status = userProgress[node.id]?.status;
        if (status === NodeStatus.LOCKED) return;

        if (status === NodeStatus.AVAILABLE) {
            updateNodeStatus(node.id, NodeStatus.LEARNING);
        }
        setSelectedNode(node);
    };

    const handleLearningComplete = async (success: boolean) => {
        if (!selectedNode) return;

        if (success) {
            await updateNodeStatus(selectedNode.id, NodeStatus.MASTERED);
            setSelectedNode(null);
        } else {
            await updateNodeStatus(selectedNode.id, NodeStatus.REMEDIATION);
        }
    };

    const handleNodeUpdate = async (updatedNode: GraphNode) => {
        // 1. Update local state
        const newNodes = currentCourse.graphData.nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
        const newCourse = { ...currentCourse, graphData: { ...currentCourse.graphData, nodes: newNodes } };
        setCurrentCourse(newCourse);

        // Update selected node reference to keep UI in sync
        setSelectedNode(updatedNode);

        // 2. Persist to DB
        try {
            await saveCourse(newCourse, currentUser.id, currentUser.role);
        } catch (e) {
            console.error("Failed to save node update", e);
            alert("保存更新失败");
        }
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <header className="h-20 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                        <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            {currentCourse.title}
                            {progressPercent === 100 && <Trophy size={18} className="text-yellow-500 animate-bounce" />}
                        </h1>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            正在学习: {currentUser.name}
                        </span>
                    </div>
                </div>

                {/* Progress Visualization */}
                <div className="flex flex-col items-end min-w-[240px]">
                    <div className="flex items-end gap-2 mb-1">
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-500 leading-none">
                            {progressPercent}%
                        </span>
                        <span className="text-xs text-slate-400 font-medium mb-1">
                            ({masteredCount} / {totalNodes} 知识点)
                        </span>
                    </div>

                    <div className="w-full flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                                style={{ width: `${progressPercent}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 animate-in fade-in slide-in-from-right-4 duration-700">
                        {encouragement.icon}
                        <span>{encouragement.text}</span>
                    </div>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Graph Visualization */}
                <div className={`${selectedNode ? 'w-1/2' : 'w-full'} transition-all duration-500 relative bg-slate-100/50 p-4`}>
                    <ForceGraph
                        nodes={currentCourse.graphData.nodes}
                        edges={currentCourse.graphData.edges}
                        progress={userProgress}
                        onNodeClick={handleNodeClick}
                        width={800}
                        height={600}
                    />
                    {!selectedNode && (
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-6 py-3 rounded-full shadow-sm border border-slate-200 text-slate-600 pointer-events-none animate-bounce">
                            点击 <span className="text-blue-600 font-bold">蓝色</span> 节点开始学习
                        </div>
                    )}
                </div>

                {/* Right: Learning Panel */}
                {selectedNode && (
                    <div className="w-1/2 border-l border-slate-200 bg-white h-full relative shadow-xl z-20">
                        <div className="absolute top-4 -left-4 z-30">
                            <button
                                onClick={() => setSelectedNode(null)}
                                className="p-2 bg-white border border-slate-200 rounded-full shadow-md text-slate-500 hover:text-blue-600 transition-transform hover:scale-110"
                                title="关闭面板"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <div className="h-full p-6">
                            <LearningPanel
                                courseId={currentCourse.id}
                                node={selectedNode}
                                status={userProgress[selectedNode.id]?.status || NodeStatus.AVAILABLE}
                                rawText={currentCourse.rawText}
                                onComplete={handleLearningComplete}
                                onOpenSettings={() => setShowSettings(true)} // Changed from () => {}
                                onNodeUpdate={handleNodeUpdate} // Added this prop
                                canEdit={!!currentCourse.hasPermission}
                                currentUser={currentUser}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CourseLearner;
