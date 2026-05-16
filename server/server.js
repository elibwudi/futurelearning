
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken'); // New Dependency

const app = express();
const PORT = process.env.PORT || 3008;
const SECRET_KEY = "your-secret-key-change-this-in-production"; // JWT Secret

// Allow explicit CORS for dev ports
app.use(cors());
// Increase limit for PDF text uploads (and large requests)
app.use(bodyParser.json({ limit: '1024mb' }));
app.use(bodyParser.urlencoded({ limit: '1024mb', extended: true }));

// Serve Static Frontend Files (Unified Mode)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Logging Middleware
app.use((req, res, next) => {
    try {
        if (req.url.startsWith('/api')) {
            const timestamp = new Date().toLocaleTimeString();
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            console.log(`[${timestamp}] ${req.method} ${req.url} from ${clientIp}`);
        }
    } catch (e) { }
    next();
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        console.log(`[Auth] No token provided for ${req.method} ${req.url}`);
        return res.sendStatus(401);
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error(`[Auth] Token verification failed:`, err.message);
            return res.sendStatus(403);
        }
        req.user = user;
        // console.log(`[Auth] User ${user.username} (${user.role}) accessed ${req.url}`);
        next();
    });
};

// Database Setup
// SQLite initialized removed. Prisma handles DB.

// --- AI Proxy Helper ---

async function getSystemSettings() {
    const settings = await prisma.settings.findFirst();
    return settings || {};
}

async function proxyAIRequest(params) {
    const settings = await getSystemSettings();
    const { provider, deepseekApiKey, deepseekModel, zhipuApiKey, zhipuModel, openaiBaseUrl, openaiApiKey, openaiModel, qwenApiKey, qwenModel, geminiApiKey, geminiModel } = settings;
    const { prompt, systemInstruction, jsonMode } = params;

    const messages = [
        { role: 'system', content: systemInstruction || 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
    ];

    let targetUrl = '';
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    if (provider === 'deepseek') {
        if (!deepseekApiKey) throw new Error("DeepSeek API Key 未配置，请联系管理员。");
        targetUrl = 'https://api.deepseek.com/chat/completions';
        headers['Authorization'] = `Bearer ${deepseekApiKey} `;
        body = {
            model: deepseekModel || 'deepseek-chat',
            messages: messages,
            stream: false,
            response_format: jsonMode ? { type: "json_object" } : undefined,
            temperature: 0.7
        };
    } else if (provider === 'zhipu') {
        if (!zhipuApiKey) throw new Error("智谱 API Key 未配置，请联系管理员。");
        targetUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
        headers['Authorization'] = `Bearer ${zhipuApiKey} `;
        body = {
            model: zhipuModel || 'glm-4-flash',
            messages: messages,
            stream: false,
            temperature: 0.7
        };
    } else if (provider === 'openai') {
        const base = (openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
        targetUrl = `${base}/chat/completions`;
        if (openaiApiKey) {
            headers['Authorization'] = `Bearer ${openaiApiKey}`;
        }
        body = {
            model: openaiModel || 'gpt-3.5-turbo',
            messages: messages,
            stream: false,
            response_format: jsonMode ? { type: "json_object" } : undefined,
            temperature: 0.7
        };
    } else if (provider === 'qwen') {
        if (!qwenApiKey) throw new Error("Qwen API Key 未配置。");
        // Compatible with OpenAI format
        targetUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
        headers['Authorization'] = `Bearer ${qwenApiKey} `;
        body = {
            model: qwenModel || 'qwen-turbo',
            messages: messages,
            stream: false,
            response_format: jsonMode ? { type: "json_object" } : undefined,
            temperature: 0.7
        };
    } else if (provider === 'gemini') {
        if (!geminiApiKey) throw new Error("Gemini API Key 未配置。");
        const modelName = geminiModel || 'gemini-1.5-flash';
        // Ensure model name doesn't have 'models/' prefix
        const cleanModelName = modelName.replace(/^models\//, '');
        targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${geminiApiKey}`;
        // Gemini handles system instruction via system_instruction field
        body = {
            contents: [
                { parts: [{ text: prompt }] }
            ],
            system_instruction: {
                parts: [{ text: systemInstruction || 'You are a helpful assistant.' }]
            },
            generationConfig: {
                temperature: 0.7,
                response_mime_type: jsonMode ? "application/json" : "text/plain"
            }
        };
    } else {
        throw new Error("Unknown provider in settings: " + provider);
    }

    try {
        console.log(`[AI Proxy] Calling ${provider}...`);
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${provider} API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();

        if (provider === 'gemini') {
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } else {
            return data.choices?.[0]?.message?.content || "";
        }
    } catch (error) {
        console.error("[AI Proxy Error]", error.message);
        throw error;
    }
}

// --- API Routes ---

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// --- Video Upload Configuration ---
const uploadDir = path.join(__dirname, 'public', 'uploads', 'videos');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2048 * 1024 * 1024 } // 2GB limit
});

app.post('/api/upload/video', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/videos/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// --- Image Upload Configuration ---
const imageUploadDir = path.join(__dirname, 'public', 'uploads', 'images');
if (!fs.existsSync(imageUploadDir)) {
    fs.mkdirSync(imageUploadDir, { recursive: true });
}

const imageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, imageUploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const imageUpload = multer({
    storage: imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for images
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只支持图片文件 (jpeg, jpg, png, gif, webp)'));
        }
    }
});

app.post('/api/upload/image', authenticateToken, imageUpload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/images/${req.file.filename}`;
    res.json({ url: fileUrl });
});

// --- NEW AUTH ROUTES ---

// 1. Signup / Migrate
app.post('/api/auth/signup', (req, res) => {
    const { username, password, name, tempId } = req.body;

    if (!username || !password) return res.status(400).json({ error: "Username and password required" });

    const newId = 'user_' + Date.now();
    const { salt, hash } = hashPassword(password);

    // 1. Create User
    prisma.user.create({
        data: { id: newId, username, passwordHash: hash, salt, name: name || username, role: 'student', isAnonymous: false }
    }).then(async () => {
        // 2. Migrate Data if tempId is provided
        if (tempId) {
            console.log(`Migrating data from ${tempId} to ${newId}`);
            try { await prisma.progress.updateMany({ where: { userId: tempId }, data: { userId: newId } }); } catch (err) { console.error("Migration Error:", err); }
        }
        const user = { id: newId, username, name: name || username, role: 'student', isAnonymous: false };
        const token = jwt.sign(user, SECRET_KEY, { expiresIn: '24h' });
        res.json({ user, token });
    }).catch(err => {
        if (err.code === 'P2002') return res.status(409).json({ error: "Username already exists" });
        return res.status(500).json({ error: err.message });
    });
});

// 2. Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    prisma.user.findUnique({ where: { username } }).then(user => {
        if (!user) return res.status(401).json({ error: "Invalid credentials" });
        if (!user.salt || !user.passwordHash) {
            console.error(`Login Failed: User ${username} missing security data (salt/hash).`);
            return res.status(401).json({ error: "Invalid credentials (legacy account)" });
        }
        if (!verifyPassword(password, user.salt, user.passwordHash)) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const userObj = { id: user.id, username: user.username, name: user.name, role: user.role, isAnonymous: user.isAnonymous };
        const token = jwt.sign(userObj, SECRET_KEY, { expiresIn: '24h' });
        res.json({ user: userObj, token });
    }).catch(err => res.status(500).json({ error: err.message }));
});

// 3. Sync/Merge (Optional: Manual sync command)
// Not strictly needed if we migrate on signup, but good for "I logged in, now move my stuff"
app.post('/api/auth/sync', (req, res) => {
    const { fromId, toId } = req.body;
    if (!fromId || !toId) return res.status(400).json({ error: "Ids required" });

    prisma.progress.updateMany({ where: { userId: fromId }, data: { userId: toId } })
        .then(result => res.json({ message: `Migrated ${result.count} records` }))
        .catch(err => res.status(500).json({ error: err.message }));
});


// --- User Management Routes ---

app.get('/api/users', authenticateToken, (req, res) => {
    // Only admin can see user list
    if (req.user.role !== 'admin') return res.sendStatus(403);

    prisma.user.findMany({ select: { id: true, name: true, role: true, username: true, isAnonymous: true }, orderBy: [{ isAnonymous: 'asc' }, { role: 'asc' }, { username: 'asc' }] })
        .then(rows => res.json(rows))
        .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/users', authenticateToken, (req, res) => {
    const { username, password, name, role } = req.body;

    // Only admin can create users
    if (req.user.role !== 'admin') return res.sendStatus(403);

    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    prisma.user.findUnique({ where: { username } }).then(row => {
        if (row) return res.status(400).json({ error: "Username already exists" });
        const newId = 'u_' + Date.now();
        const { salt, hash } = hashPassword(password);
        prisma.user.create({ data: { id: newId, name: name || username, role: role || 'teacher', username, passwordHash: hash, salt, isAnonymous: false } })
            .then(() => res.json({ id: newId, username, role, name }))
            .catch(err => res.status(500).json({ error: err.message }));
    }).catch(err => res.status(500).json({ error: err.message }));
});

app.delete('/api/users/:id', authenticateToken, (req, res) => {
    // Only admin can delete users
    if (req.user.role !== 'admin') return res.sendStatus(403);

    // Prevent deleting the default admin or yourself
    if (req.params.id === 'u_admin') return res.status(403).json({ error: "Cannot delete default admin" });
    if (req.params.id === req.user.id) return res.status(403).json({ error: "Cannot delete yourself" });

    prisma.user.delete({ where: { id: req.params.id } })
        .then(() => res.json({ message: "User deleted" }))
        .catch(err => res.status(500).json({ error: err.message }));
});

app.put('/api/users/:id/password', authenticateToken, (req, res) => {
    const { password, oldPassword } = req.body;
    const userId = req.params.id;
    const isSelfUpdate = req.user.id === userId;
    const isAdminReset = req.user.role === 'admin' && !isSelfUpdate;

    console.log(`[Password Change] Request from ${req.user.username} (role: ${req.user.role}) to ${isSelfUpdate ? 'change own password' : 'reset password for user ' + userId}`);

    // Permission Check: Only admin or the user themselves can change password
    if (!isAdminReset && !isSelfUpdate) {
        console.log(`[Password Change] Permission denied: ${req.user.username} tried to change password for ${userId}`);
        return res.sendStatus(403);
    }

    // Validation: Password length
    if (!password || password.length < 6) {
        console.log(`[Password Change] Validation failed: password length = ${password?.length || 0}`);
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // If user is changing their own password, verify old password
    if (isSelfUpdate) {
        if (!oldPassword) {
            console.log(`[Password Change] Self-update requires old password, but none provided`);
            return res.status(400).json({ error: "修改密码需要提供旧密码" });
        }

        prisma.user.findUnique({ where: { id: userId }, select: { salt: true, passwordHash: true } }).then(user => {
            if (!user) return res.status(404).json({ error: "User not found" });
            if (!verifyPassword(oldPassword, user.salt, user.passwordHash)) return res.status(401).json({ error: "旧密码不正确" });
            updatePassword();
        }).catch(err => res.status(500).json({ error: err.message }));
    } else {
        // Admin reset - no old password verification needed
        console.log(`[Password Change] Admin reset mode - skipping old password verification`);
        updatePassword();
    }

    function updatePassword() {
        const { salt, hash } = hashPassword(password);
        console.log(`[Password Change] Generated hash for user ${userId}, salt: ${salt.substring(0, 8)}..., hash: ${hash.substring(0, 16)}...`);

        prisma.user.update({ where: { id: userId }, data: { passwordHash: hash, salt: salt } })
            .then(() => res.json({ message: "Password updated successfully" }))
            .catch(err => {
                if (err.code === 'P2025') return res.status(404).json({ error: "User not found" });
                res.status(500).json({ error: err.message });
            });
    }
});

app.get('/api/settings', (req, res) => {
    prisma.settings.findUnique({ where: { id: 1 } })
        .then(row => res.json(row))
        .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/settings', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);

    const { provider, deepseekApiKey, deepseekModel, zhipuApiKey, zhipuModel, openaiBaseUrl, openaiApiKey, openaiModel, qwenApiKey, qwenModel, geminiApiKey, geminiModel } = req.body;
    prisma.settings.upsert({
        where: { id: 1 },
        update: { provider, deepseekApiKey, deepseekModel, zhipuApiKey, zhipuModel, openaiBaseUrl, openaiApiKey, openaiModel, qwenApiKey, qwenModel, geminiApiKey, geminiModel },
        create: { id: 1, provider, deepseekApiKey, deepseekModel, zhipuApiKey, zhipuModel, openaiBaseUrl, openaiApiKey, openaiModel, qwenApiKey, qwenModel, geminiApiKey, geminiModel }
    }).then(() => res.json({ message: "Settings updated" }))
      .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/ai/chat', async (req, res) => {
    try {
        req.setTimeout(300000);
        const result = await proxyAIRequest(req.body);
        res.json({ result });
    } catch (error) {
        console.error("AI Route Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- Content Cache Routes ---
app.get('/api/cache/:courseId/:nodeId/:type', (req, res) => {
    const { courseId, nodeId, type } = req.params;
    prisma.contentCache.findUnique({ where: { courseId_nodeId_type: { courseId, nodeId, type } }, select: { data: true } })
        .then(row => res.json(row ? { found: true, data: row.data } : { found: false }))
        .catch(err => res.status(400).json({ error: err.message }));
});

app.post('/api/cache', authenticateToken, (req, res) => {
    const { courseId, nodeId, type, data } = req.body;
    const { id: userId, role } = req.user;

    // Security Check for Cache Modification
    prisma.course.findUnique({ where: { id: courseId }, select: { authorId: true } }).then(row => {
        if (!row) return res.status(404).json({ error: "Course not found" });
        const isAdmin = role === 'admin' || (userId === 't1' && role === 'teacher');
        if (isAdmin || row.authorId === userId) return saveCache();
        
        prisma.coursePermission.findFirst({ where: { courseId, userId } }).then(permRow => {
            if (!permRow) return res.status(403).json({ error: "Permission denied." });
            saveCache();
        }).catch(err => res.status(500).json({ error: err.message }));
    }).catch(err => res.status(500).json({ error: err.message }));

    function saveCache() {
        prisma.contentCache.upsert({
            where: { courseId_nodeId_type: { courseId, nodeId, type } },
            update: { data },
            create: { courseId, nodeId, type, data, createdAt: new Date() }
        }).then(() => res.json({ message: "Cache saved" }))
          .catch(err => res.status(400).json({ error: err.message }));
    }
});

// --- Course Permissions Routes (Multi-Teacher Support) ---

// Get all teachers with permission for a course
app.get('/api/courses/:id/permissions', (req, res) => {
    const courseId = req.params.id;

    prisma.coursePermission.findMany({
        where: { courseId },
        select: { userId: true, permissionLevel: true, grantedAt: true, grantedBy: true, user: { select: { name: true, username: true, role: true } } },
        orderBy: { grantedAt: 'desc' }
    }).then(rawRows => {
        const rows = rawRows.map(r => ({ ...r, name: r.user?.name, username: r.user?.username, role: r.user?.role }));
        res.json(rows);
    }).catch(err => res.status(500).json({ error: err.message }));
});

// Add teacher permission to a course
app.post('/api/courses/:id/permissions', authenticateToken, (req, res) => {
    const courseId = req.params.id;
    const { teacherId, permissionLevel } = req.body;
    const { id: adminId, role: adminRole } = req.user;

    // Permission Check: Only admins can assign
    if (adminRole !== 'admin') {
        return res.status(403).json({ error: "只有管理员可以分配课程权限" });
    }

    // Validate permission level
    const level = permissionLevel || 'member';
    if (level !== 'owner' && level !== 'member') {
        return res.status(400).json({ error: "无效的权限等级" });
    }

    // Verify teacher exists
    prisma.user.findUnique({ where: { id: teacherId }, select: { id: true, role: true, name: true } }).then(teacher => {
        if (!teacher) return res.status(404).json({ error: "用户不存在" });
        if (teacher.role !== 'teacher' && teacher.role !== 'admin') return res.status(400).json({ error: "只能授权给教师或管理员" });

        prisma.coursePermission.upsert({
            where: { courseId_userId: { courseId, userId: teacherId } },
            update: { permissionLevel: level, grantedBy: adminId, grantedAt: new Date() },
            create: { courseId, userId: teacherId, permissionLevel: level, grantedBy: adminId, grantedAt: new Date() }
        }).then(() => {
            const levelName = level === 'owner' ? '课程责任教师' : '课程团队成员';
            res.json({ message: `权限已授予（${levelName}）`, teacherId, teacherName: teacher.name, permissionLevel: level });
        }).catch(err => res.status(500).json({ error: err.message }));
    }).catch(err => res.status(500).json({ error: err.message }));
});

// Remove teacher permission from a course
app.delete('/api/courses/:id/permissions/:userId', authenticateToken, (req, res) => {
    const { id: courseId, userId: teacherId } = req.params;
    const { role: adminRole } = req.user;

    if (adminRole !== 'admin') {
        return res.status(403).json({ error: "只有管理员可以移除权限" });
    }

    prisma.coursePermission.delete({ where: { courseId_userId: { courseId, userId: teacherId } } })
        .then(() => res.json({ message: "权限已移除" }))
        .catch(err => {
            if (err.code === 'P2025') return res.json({ message: "该教师没有此课程的权限" });
            res.status(500).json({ error: err.message });
        });
});



// Duplicate route removed (correct version exists above)



app.get('/api/courses', (req, res) => {
    // Optional Auth: Decode token if present, else default to student
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let user = { role: 'student', id: null };

    if (token) {
        try {
            user = jwt.verify(token, SECRET_KEY);
        } catch (e) {
            // Invalid token -> Treat as student (or could 403, but let's be graceful for public view)
        }
    }
    const { id: userId, role } = user;
    const isTeacherOrAdmin = role === 'teacher' || role === 'admin';

    prisma.course.findMany({ select: { id: true, title: true, description: true, graphData: true, createdAt: true, status: true, authorId: true } }).then(rawRows => {
        const rows = rawRows.map(r => ({ ...r, createdAt: r.createdAt.getTime() }));
        let visibleRows = rows;
        if (!isTeacherOrAdmin) visibleRows = rows.filter(r => r.status !== 'hidden');

        if (role === 'teacher' && userId) {
            prisma.coursePermission.findMany({ where: { userId }, select: { courseId: true, permissionLevel: true } }).then(permissions => {
                const permissionMap = new Map(permissions.map(p => [p.courseId, p.permissionLevel]));
                const courses = visibleRows.map(row => {
                    const isAuthor = row.authorId === userId;
                    const permLevel = permissionMap.get(row.id);
                    let parsedGraph = { nodes: [], edges: [] };
                    try { parsedGraph = typeof row.graphData === 'string' ? JSON.parse(row.graphData || '{"nodes":[],"edges":[]}') : row.graphData || {nodes:[], edges:[]}; } catch(e){}
                    return { ...row, graphData: parsedGraph, rawText: "", hasPermission: isAuthor || !!permLevel, permissionLevel: isAuthor ? 'owner' : (permLevel || null) };
                });
                res.json(courses);
            }).catch(err => res.status(500).json({ error: err.message }));
        } else if (role === 'admin') {
            const courses = visibleRows.map(row => {
                let parsedGraph = { nodes: [], edges: [] };
                try { parsedGraph = typeof row.graphData === 'string' ? JSON.parse(row.graphData || '{"nodes":[],"edges":[]}') : row.graphData || {nodes:[], edges:[]}; } catch(e){}
                return { ...row, graphData: parsedGraph, rawText: "", hasPermission: true, permissionLevel: 'owner' };
            });
            res.json(courses);
        } else {
            const courses = visibleRows.map(row => {
                let parsedGraph = { nodes: [], edges: [] };
                try { parsedGraph = typeof row.graphData === 'string' ? JSON.parse(row.graphData || '{"nodes":[],"edges":[]}') : row.graphData || {nodes:[], edges:[]}; } catch(e){}
                return { ...row, graphData: parsedGraph, rawText: "", hasPermission: false };
            });
            res.json(courses);
        }
    }).catch(err => res.status(400).json({ error: err.message }));
});


app.get('/api/courses/:id', (req, res) => {
    // Optional Auth
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let user = { role: 'student', id: null };

    if (token) {
        try { user = jwt.verify(token, SECRET_KEY); } catch (e) { }
    }
    const { id: userId, role } = user;

    prisma.course.findUnique({ where: { id: req.params.id } }).then(row => {
        if (!row) return res.status(404).json({ error: "Course not found" });
        row.createdAt = row.createdAt.getTime();
        
        let parsedGraph = { nodes: [], edges: [] };
        try { parsedGraph = typeof row.graphData === 'string' ? JSON.parse(row.graphData || '{"nodes":[],"edges":[]}') : row.graphData || {nodes:[], edges:[]}; } catch(e){}

        if (role === 'admin') {
            res.json({ ...row, graphData: parsedGraph, hasPermission: true, permissionLevel: 'owner' });
        } else if (role === 'teacher' && userId) {
            if (row.authorId === userId) {
                res.json({ ...row, graphData: parsedGraph, hasPermission: true, permissionLevel: 'owner' });
            } else {
                prisma.coursePermission.findUnique({ where: { courseId_userId: { courseId: req.params.id, userId } }, select: { permissionLevel: true } }).then(permRow => {
                    res.json({ ...row, graphData: parsedGraph, hasPermission: !!permRow, permissionLevel: permRow?.permissionLevel || null });
                }).catch(err => res.status(500).json({ error: err.message }));
            }
        } else {
            res.json({ ...row, graphData: parsedGraph, hasPermission: false, permissionLevel: null });
        }
    }).catch(err => res.status(400).json({ error: err.message }));
});

app.put('/api/courses/:id/visibility', authenticateToken, (req, res) => {
    const { hidden } = req.body;
    const { id: userId, role } = req.user;

    // Only Admin or Author can toggle visibility
    prisma.course.findUnique({ where: { id: req.params.id }, select: { authorId: true } }).then(row => {
        if (!row) return res.status(404).json({ error: "Course not found" });
        if (role !== 'admin' && row.authorId !== userId) return res.sendStatus(403);
        const newStatus = hidden ? 'hidden' : 'ready';
        prisma.course.update({ where: { id: req.params.id }, data: { status: newStatus } }).then(() => {
            res.json({ message: `Course ${hidden ? 'hidden' : 'visible'}` });
        }).catch(err => res.status(500).json({ error: err.message }));
    }).catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/courses', authenticateToken, (req, res) => {
    const { id, title, description, rawText, graphData, createdAt, status, authorId } = req.body;
    const { id: userId, role } = req.user;

    prisma.course.findUnique({ where: { id }, select: { authorId: true } }).then(row => {
        if (row) {
            const isAdmin = role === 'admin' || (userId === 't1' && role === 'teacher');
            if (isAdmin || row.authorId === userId) return saveCourse();
            
            prisma.coursePermission.findFirst({ where: { courseId: id, userId } }).then(permRow => {
                if (!permRow) return res.status(403).json({ error: "Permission denied." });
                saveCourse();
            }).catch(err => res.status(500).json({ error: err.message }));
        } else {
            if (role !== 'teacher' && role !== 'admin') return res.sendStatus(403);
            saveCourse();
        }

        function saveCourse() {
            prisma.course.upsert({
                where: { id },
                update: { title, description, rawText, graphData, status: status || 'draft', authorId: authorId || userId },
                create: { id, title, description, rawText, graphData, createdAt: new Date(createdAt), status: status || 'draft', authorId: authorId || userId }
            }).then(result => res.json({ message: "Saved", id: result.id }))
              .catch(err => res.status(400).json({ error: err.message }));
        }
    }).catch(err => res.status(500).json({ error: err.message }));
});

app.delete('/api/courses/:id', authenticateToken, (req, res) => {
    // Rely on Token
    const { id: qUserId, role: qRole } = req.user;

    prisma.course.findUnique({ where: { id: req.params.id }, select: { authorId: true } }).then(row => {
        if (!row) return res.status(404).json({ error: "Course not found" });
        const isAdmin = qRole === 'admin' || (qUserId === 't1' && qRole === 'teacher');
        if (isAdmin || row.authorId === qUserId) return deleteCourse();

        prisma.coursePermission.findFirst({ where: { courseId: req.params.id, userId: qUserId } }).then(permRow => {
            if (!permRow) return res.status(403).json({ error: "Permission denied." });
            deleteCourse();
        }).catch(err => res.status(500).json({ error: err.message }));

        function deleteCourse() {
            prisma.coursePermission.deleteMany({ where: { courseId: req.params.id } }).then(() => {
                return prisma.contentCache.deleteMany({ where: { courseId: req.params.id } });
            }).then(() => {
                return prisma.progress.deleteMany({ where: { courseId: req.params.id } });
            }).then(() => {
                return prisma.course.delete({ where: { id: req.params.id } });
            }).then(() => res.json({ message: "Deleted" }))
              .catch(err => res.status(400).json({ error: err.message }));
        }
    }).catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/progress/:userId/:courseId', authenticateToken, (req, res) => {
    const { userId, courseId } = req.params;
    // Security: Only allow fetching own progress or admin
    if (req.user.id !== userId && req.user.role !== 'admin') return res.sendStatus(403);

    prisma.progress.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { data: true } })
        .then(row => {
            const parsedData = typeof row?.data === 'string' ? JSON.parse(row.data) : row?.data;
            res.json(parsedData || {});
        })
        .catch(err => res.status(400).json({ error: err.message }));
});

app.post('/api/progress', authenticateToken, (req, res) => {
    const { userId, courseId, data } = req.body;
    // Security: Only allow saving own progress
    if (req.user.id !== userId) return res.sendStatus(403);

    prisma.progress.upsert({
        where: { userId_courseId: { userId, courseId } },
        update: { data },
        create: { userId, courseId, data }
    }).then(() => res.json({ message: "Saved" }))
      .catch(err => res.status(400).json({ error: err.message }));
});

app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return res.status(404).json({ error: 'Not Found' });
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// CRITICAL FIX: Bind to 0.0.0.0 to ensure IPv4 accessibility for local proxies and external clients
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});

// Increase Server Timeout to 10 minutes (600,000 ms) for large uploads
server.timeout = 600000;
server.keepAliveTimeout = 600000;
server.headersTimeout = 601000;
