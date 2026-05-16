
import { KnowledgeGraphData, QuizQuestion, AISettings } from "../types";
import { getCachedContent, saveCachedContent } from "./storageService";

// Storage Keys
const STORAGE_KEY_JWT_TOKEN = 'cognitive_map_jwt_token';

// Helper: JSON Cleanup
const cleanJson = (text: string) => {
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstOpen = cleaned.indexOf('{');
    const firstArray = cleaned.indexOf('[');

    // Detect if object or array starts first
    const start = (firstArray !== -1 && (firstOpen === -1 || firstArray < firstOpen)) ? firstArray : firstOpen;
    const lastClose = cleaned.lastIndexOf(start === firstArray ? ']' : '}');

    if (start !== -1 && lastClose !== -1) {
        cleaned = cleaned.substring(start, lastClose + 1);
    }
    return cleaned;
};

// --- API Base Logic ---
// Always use relative path. 
// In Dev (3008), Vite Proxy forwards to 3001.
// In Prod (3001), it's served directly.
const API_BASE = '/api';

export const getSettings = async (): Promise<AISettings> => {
    try {
        const res = await fetch(`${API_BASE}/settings`);
        if (!res.ok) throw new Error("Failed to fetch settings");
        return await res.json();
    } catch (e) {
        console.error("Error fetching settings:", e);
        return {
            provider: 'deepseek',
            deepseekApiKey: '', deepseekModel: 'deepseek-chat',
            zhipuApiKey: '', zhipuModel: 'glm-4-flash',
            openaiBaseUrl: '', openaiApiKey: '', openaiModel: '',
            qwenApiKey: '', qwenModel: 'qwen-turbo',
            geminiApiKey: '', geminiModel: 'gemini-1.5-flash'
        };
    }
};

export const saveSettings = async (settings: AISettings): Promise<void> => {
    const token = localStorage.getItem(STORAGE_KEY_JWT_TOKEN);
    const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(settings)
    });
    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(error.error || "Failed to save settings");
    }
};

// --- Unified Backend Caller ---

const callAI = async (prompt: string, systemInstruction: string, jsonMode: boolean = false): Promise<string> => {
    try {
        // Get JWT token from localStorage for authentication
        const token = localStorage.getItem(STORAGE_KEY_JWT_TOKEN);

        const response = await fetch(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                prompt: prompt,
                systemInstruction: systemInstruction,
                jsonMode: jsonMode
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Server Error ${response.status}`);
        }

        const data = await response.json();
        return data.result;
    } catch (error: any) {
        console.error("AI Proxy Call Failed:", error);
        throw new Error(error.message || "无法连接到 AI 服务");
    }
};

// --- Exported Services ---

export const testConnection = async (): Promise<{ success: boolean, message: string }> => {
    try {
        await callAI("Hello", "Test", false);
        return { success: true, message: "AI 服务连接成功！" };
    } catch (e: any) {
        return { success: false, message: `连接失败: ${e.message}` };
    }
};

export const generateGraphFromText = async (text: string): Promise<KnowledgeGraphData> => {
    if (!text) throw new Error("Text is required");
    const maxChars = 12000;
    const safeText = text.length > maxChars ? text.substring(0, maxChars) : text;

    const prompt = `
    分析以下教材内容并构建学习知识图谱。
    任务：
    1. 识别核心知识概念（节点），提取 40-45 个概念。
    2. 建立逻辑依赖关系（边）。
    3. 确保 label 简练，description 通俗易懂。
    返回 JSON: { "nodes": [{"id": "c1", "label": "...", "description": "..."}], "edges": [{"source": "c1", "target": "c2", "relationship": "..."}] }
    文本内容： "${safeText}" 
  `;

    const resultText = await callAI(prompt, "你是一位专业的课程架构师。请输出严格的 JSON。", true);
    const parsed = JSON.parse(cleanJson(resultText));
    if (!parsed.nodes || !parsed.edges) throw new Error("返回结构不完整");
    return parsed as KnowledgeGraphData;
};

export const generateLessonContent = async (
    courseId: string,
    nodeId: string,
    topic: string,
    context: string,
    isRemediation: boolean = false,
    bypassCache: boolean = false
): Promise<string> => {

    const cacheType = isRemediation ? 'remediation' : 'lesson';

    if (!bypassCache) {
        const cached = await getCachedContent(courseId, nodeId, cacheType);
        if (cached) {
            console.log("Using cached lesson content");
            return cached;
        }
    } else {
        console.log("Bypassing cache for lesson content regeneration");
    }

    const maxCtx = 3000;
    const prompt = isRemediation
        ? `学生在测验中未能掌握「${topic}」。请作为一名资深导师，采用以下结构重新讲解：
           <h3>1. 换个角度看问题</h3> 用更通俗的比喻或案例切入。
           <h3>2. 深度剖析</h3> 拆解难点，确保逻辑清晰。
           <h3>3. 典型例题</h3> 演示一个具体场景或问题的解决过程。
           <h3>4. 避坑指南</h3> 提醒最容易出错的地方。
           
           注意事项：
           - **严禁使用 \`**\` 符号进行加粗**。
           - 请使用 \`<b>内容</b>\` 标签对关键词进行加粗。
           - 核心概念请放在 「」 引号中。
           - 使用 Markdown 结构但内容排版要适合 Web 直接呈现。
           
           上下文参考：${context.substring(0, maxCtx)}...`
        : `请教授「${topic}」这个知识点。要求既专业又生动，按以下结构生成：
           <h3>1. 为什么学这个？</h3> 与现实生活或后续知识的关联（现实引入）。
           <h3>2. 核心大揭秘</h3> 深入浅出的理论讲解，使用 <b> 加粗关键词。
           <h3>3. 场景实战</h3> 提供一个精彩的案例演示或代码示例。
           <h3>4. 互动小思考</h3> 提出 1-2 个启发性的问题引导学生思考。
           <h3>5. 学习秘籍</h3> 总结 1-2 条高效掌握该知识点的建议。
           
           注意事项：
           - **绝对不要使用 \`**\` 符号**。
           - 重点词汇请使用 \`<b>\` 标签。
           - 概念名称请使用 「」 引号。
           - 段落清晰，适合网页端阅读。
           
           上下文：${context.substring(0, maxCtx)}...`;

    const content = await callAI(prompt, "你是一位善于启发、注重实战的中文人工智能金牌导师。你更倾向于使用 HTML 标签（如 b, h3）而非 Markdown 符号来增强视觉呈现。", false);

    if (content && content.length > 50) {
        await saveCachedContent(courseId, nodeId, cacheType, content);
    }

    return content;
};

// Generates a pool of 10 questions, caches them, and returns a random subset of 3
export const generateQuizSession = async (
    courseId: string,
    nodeId: string,
    topic: string,
    context: string,
    bypassCache: boolean = false
): Promise<QuizQuestion[]> => {

    // 1. Check for existing QUESTION POOL (Array of 10)
    let quizPool: QuizQuestion[] = [];
    if (!bypassCache) {
        const cachedPoolStr = await getCachedContent(courseId, nodeId, 'quiz_pool');
        if (cachedPoolStr) {
            console.log("Using cached quiz pool");
            try {
                quizPool = JSON.parse(cachedPoolStr);
            } catch (e) { console.error("Cache parse error", e); }
        }
    } else {
        console.log("Bypassing cache for quiz pool regeneration");
    }

    // 2. If Pool missing or empty, generate 10 questions
    if (quizPool.length === 0) {
        console.log("Generating new quiz pool (10 questions)...");
        const maxCtx = 2500;
        const prompt = `
      Based on the context about "${topic}", generate 10 distinct multiple-choice questions.
      Requirements:
      - 3 Easy questions (basic definitions)
      - 4 Medium questions (understanding/application)
      - 3 Hard questions (analysis/distinction)
      - Content in Simplified Chinese.
      - Output strictly as a JSON ARRAY of objects. Do not wrap in markdown or objects.
      
      JSON Structure per item:
      {
        "id": "q1",
        "difficulty": "Easy",
        "question": "...",
        "options": ["A", "B", "C", "D"],
        "correctOptionIndex": 0,
        "explanation": "..."
      }
      
      Context: ${context.substring(0, maxCtx)}
      `;

        // NOTE: jsonMode=false used here because some providers (like DeepSeek) in strict JSON mode
        // might fail if we ask for an ARRAY at the root. We trust prompt and cleanJson.
        const text = await callAI(prompt, "You are a rigorous exam setter. Output only JSON array.", false);

        try {
            const cleaned = cleanJson(text);
            quizPool = JSON.parse(cleaned);

            // Basic Validation
            if (!Array.isArray(quizPool) || quizPool.length === 0) throw new Error("AI returned invalid structure (not array)");

            // Save to cache
            await saveCachedContent(courseId, nodeId, 'quiz_pool', JSON.stringify(quizPool));

        } catch (e: any) {
            console.error("Quiz generation failed", e);
            throw new Error(e.message || "生成题库失败，请重试。");
        }
    }

    // 3. Randomly select 3 distinct questions for this session
    // Shuffle array
    const shuffled = quizPool.sort(() => 0.5 - Math.random());
    // Pick top 3
    const selectedQuestions = shuffled.slice(0, 3);

    return selectedQuestions;
};

export const chatWithTutor = async (history: { role: string, parts: { text: string }[] }[], message: string): Promise<string> => {
    const historyText = history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n');
    const fullPrompt = `历史对话:\n${historyText}\n\n用户: ${message}`;
    return await callAI(fullPrompt, "你是一位AI导师。请回答学生的问题。", false);
}

export const updateQuizQuestion = async (
    courseId: string,
    nodeId: string,
    updatedQuestion: QuizQuestion
): Promise<void> => {
    // 1. Get existing pool
    const cachedPoolStr = await getCachedContent(courseId, nodeId, 'quiz_pool');
    if (!cachedPoolStr) throw new Error("Quiz pool not found");

    try {
        const quizPool: QuizQuestion[] = JSON.parse(cachedPoolStr);
        const index = quizPool.findIndex(q => q.id === updatedQuestion.id);

        if (index !== -1) {
            // Update
            quizPool[index] = updatedQuestion;
            // Save back
            await saveCachedContent(courseId, nodeId, 'quiz_pool', JSON.stringify(quizPool));
        } else {
            throw new Error("Question not found in pool");
        }
    } catch (e: any) {
        console.error("Failed to update quiz question", e);
        throw e;
    }
};
