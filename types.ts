
export enum NodeStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  LEARNING = 'LEARNING',
  MASTERED = 'MASTERED',
  REMEDIATION = 'REMEDIATION' // Failed the quiz, needs review
}

export interface GraphNode {
  id: string;
  label: string;
  description: string;
  x?: number; // For D3 simulation
  y?: number; // For D3 simulation
  fx?: number | null; // For D3 drag
  fy?: number | null; // For D3 drag
  videoUrl?: string;
}

export interface GraphEdge {
  source: string | GraphNode; // D3 converts string ID to object
  target: string | GraphNode;
  relationship: string;
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface UserProgress {
  [nodeId: string]: {
    status: NodeStatus;
    score?: number;
    attempts: number;
  };
}

export interface QuizQuestion {
  id: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface QuizResult {
  passed: boolean;
  score: number;
  feedback: string;
}

// --- Platform Types ---

export interface User {
  id: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  username?: string;
  isAnonymous?: boolean;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  rawText: string; // The full textbook content
  graphData: KnowledgeGraphData;
  createdAt: number;
  status?: 'draft' | 'ready' | 'hidden'; // Course maturity status
  authorId?: string;
  hasPermission?: boolean; // Whether current user can edit this course
  permissionLevel?: 'owner' | 'member' | null; // Permission level: owner (full), member (content only), or none
}

// --- Settings Types ---

export type AIProvider = 'deepseek' | 'zhipu' | 'openai' | 'qwen' | 'gemini';

export interface AISettings {
  provider: AIProvider;

  // OpenAI Compatible
  openaiBaseUrl: string; // e.g., http://10.255.1.118:8000/v1
  openaiApiKey: string;
  openaiModel: string;   // e.g., gemma-4-moe

  // DeepSeek
  deepseekApiKey: string;
  deepseekModel: string; // e.g., deepseek-chat

  // Zhipu (ChatGLM)
  zhipuApiKey: string;
  zhipuModel: string; // e.g., glm-4-flash

  // Qwen (Tongyi Qianwen)
  qwenApiKey: string;
  qwenModel: string; // e.g., qwen-turbo

  // Google Gemini
  geminiApiKey: string;
  geminiModel: string; // e.g., gemini-1.5-flash
}
