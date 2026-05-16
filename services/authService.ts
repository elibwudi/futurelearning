
import { User } from '../types';

const API_BASE = '/api';
const STORAGE_KEY_AUTH_USER = 'cognitive_map_auth_user';
const STORAGE_KEY_JWT_TOKEN = 'cognitive_map_jwt_token';

// Unified API Caller (matches storageService)
const apiCall = async (endpoint: string, options?: RequestInit) => {
    const url = `${API_BASE}${endpoint}`;

    // Auto-attach Token
    const token = localStorage.getItem(STORAGE_KEY_JWT_TOKEN);
    const headers = new Headers(options?.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Ensure Content-Type is set if body exists and not FormData
    if (options?.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, config);

        if (response.status === 401 || response.status === 403) {
            // Check if it's an auth error - strictly speaking we might want to logout
            // but let's just let the caller handle it or throw specific error
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Server Error (${response.status})`);
        }
        return await response.json();
    } catch (e: any) {
        // Prepare meaningful error message
        let msg = e.message;
        try {
            // If error text is JSON
            const json = JSON.parse(e.message);
            if (json.error) msg = json.error;
        } catch { }
        console.error(`Auth API Failed [${endpoint}]:`, msg);
        throw new Error(msg);
    }
};

export const getCurrentUser = (): User | null => {
    const stored = localStorage.getItem(STORAGE_KEY_AUTH_USER);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            localStorage.removeItem(STORAGE_KEY_AUTH_USER);
        }
    }
    return null;
};

export const login = async (username: string, password: string): Promise<User> => {
    const result = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    });

    const { user, token } = result;
    localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
    if (token) localStorage.setItem(STORAGE_KEY_JWT_TOKEN, token);
    return user;
};

export const signup = async (username: string, password: string, name?: string, tempId?: string): Promise<User> => {
    const result = await apiCall('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password, name, tempId })
    });

    const { user, token } = result;
    localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
    if (token) localStorage.setItem(STORAGE_KEY_JWT_TOKEN, token);
    return user;
};

export const logout = () => {
    localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    localStorage.removeItem(STORAGE_KEY_JWT_TOKEN);
};

// Expose apiCall for other services to use? 
// Ideally storageService should import it, but it has its own copy.
// We will update storageService to use this one or update its own similarly.
export { apiCall }; // Exporting for reuse in storageService if we refactor
