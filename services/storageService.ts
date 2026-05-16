
import { Course, User, UserProgress } from '../types';
import { apiCall } from './authService';

const API_BASE = '/api';

export const checkBackendHealth = async (): Promise<{ success: boolean, message: string }> => {
    try {
        // We can use fetch directly here or apiCall. apiCall throws on error which we catch.
        await apiCall('/health');
        return { success: true, message: "后端连接正常" };
    } catch (e: any) {
        return { success: false, message: "连接失败" };
    }
};

export const initDB = async () => {
    await checkBackendHealth();
};

export const getCourses = async (userId?: string, role?: string): Promise<Course[]> => {
    // Legacy params (userId, role) are ignored needed for calls, as token handles it.
    // Kept in signature to avoid breaking App.tsx immediately if strictly typed elsewhere, 
    // though App.tsx should be fine.
    return apiCall(`/courses`);
};

export const getCourseById = async (id: string, userId?: string, role?: string): Promise<Course> => {
    return apiCall(`/courses/${id}`);
};

export const toggleCourseVisibility = async (courseId: string, hidden: boolean): Promise<void> => {
    await apiCall(`/courses/${courseId}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden })
    });
};

export const saveCourse = async (course: Course, userId?: string, role?: string): Promise<void> => {
    // userId and role are extracted from token by backend
    await apiCall('/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...course, userId, role }) // Sending them doesn't hurt, but backend ignores/verifies them
    });
};

export const deleteCourse = async (courseId: string, userId?: string, role?: string): Promise<void> => {
    await apiCall(`/courses/${courseId}`, { method: 'DELETE' });
};

// User Management
export const getUsers = async (): Promise<User[]> => {
    return await apiCall('/users');
};

export const createUser = async (userData: any): Promise<void> => {
    await apiCall('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
};

export const deleteUser = async (userId: string): Promise<void> => {
    await apiCall(`/users/${userId}`, { method: 'DELETE' });
};

export const resetUserPassword = async (userId: string, newPassword: string): Promise<void> => {
    await apiCall(`/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
    });
};

/**
 * User changes their own password (requires old password verification)
 */
export const updateMyPassword = async (userId: string, oldPassword: string, newPassword: string): Promise<void> => {
    await apiCall(`/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            password: newPassword,
            oldPassword: oldPassword
        })
    });
};

export const getUserProgress = async (userId: string, courseId: string): Promise<UserProgress> => {
    return await apiCall(`/progress/${userId}/${courseId}`);
};

export const saveUserProgress = async (userId: string, courseId: string, progress: UserProgress): Promise<void> => {
    await apiCall('/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId, data: progress })
    });
};

// --- Identity Management (STRICT & SECURE) ---
const STORAGE_KEY_USER_ID = 'cognitive_map_identity_FINAL_SECURE_v1';

const ADJECTIVES = [
    "充满好奇的", "勤奋的", "坚毅的", "快乐的", "聪明的", "勇敢的", "专注的", "富有创意的",
    "不知疲倦的", "闪光的", "积极的", "乐观的", "深思熟虑的", "锐意进取的"
];
const NOUNS = [
    "探索者", "追梦人", "学习家", "思考者", "挑战者", "航海家", "攀登者", "发明家", "阅读者", "实践家"
];

const generateRandomName = () => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj}${noun}`;
};

const generateUUID = () => {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

export const getAnonymousUser = (): User => {
    let identityStr = localStorage.getItem(STORAGE_KEY_USER_ID);
    let identity: any;
    let needReset = false;

    if (identityStr) {
        try {
            identity = JSON.parse(identityStr);
            if (!identity.id || !identity.id.startsWith('user_')) {
                needReset = true;
            }
        } catch (e) {
            needReset = true;
        }
    } else {
        needReset = true;
    }

    if (needReset) {
        identity = {
            id: generateUUID(),
            name: generateRandomName(),
        };
        localStorage.setItem(STORAGE_KEY_USER_ID, JSON.stringify(identity));
    }

    return {
        id: identity.id,
        name: identity.name,
        role: 'student'
    };
};

// --- Cache Methods ---
export const getCachedContent = async (courseId: string, nodeId: string, type: string): Promise<string | null> => {
    try {
        const result = await apiCall(`/cache/${courseId}/${nodeId}/${type}`);
        return result.found ? result.data : null;
    } catch (e) {
        return null;
    }
};

export const saveCachedContent = async (courseId: string, nodeId: string, type: string, data: string, userId?: string, role?: string): Promise<void> => {
    try {
        await apiCall('/cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, nodeId, type, data, userId, role })
        });
    } catch (e) {
        console.error("Cache save failed:", e);
    }
};
