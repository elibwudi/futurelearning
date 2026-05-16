/**
 * 数据迁移脚本：SQLite → PostgreSQL
 * 执行：node server/migrate_data.js
 */

const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const SQLITE_PATH = path.join(__dirname, 'database.sqlite');
const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

// 从 SQLite 读取全部数据
function readSQLite() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(SQLITE_PATH);
        const result = {};
        const TABLES = ['users', 'courses', 'progress', 'settings', 'content_cache', 'course_permissions'];
        let done = 0;
        TABLES.forEach(t => {
            db.all(`SELECT * FROM ${t}`, (err, rows) => {
                if (err) { result[t] = []; console.error(`读取 ${t} 失败:`, err.message); }
                else result[t] = rows;
                if (++done === TABLES.length) { db.close(); resolve(result); }
            });
        });
    });
}

function safeJSON(val) {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return null; }
}

function safeDate(ts) {
    if (!ts) return new Date();
    if (ts > 1e12) return new Date(ts);     // 毫秒时间戳
    return new Date(ts * 1000);              // 秒时间戳
}

async function migrate() {
    console.log('\n🚀 开始数据迁移：SQLite → PostgreSQL\n');
    const data = await readSQLite();

    // 打印源数据量
    Object.entries(data).forEach(([t, rows]) => console.log(`  📦 ${t.padEnd(22)}: ${rows.length} 条`));
    console.log();

    // ── 1. Users ──────────────────────────────────────────
    console.log('1️⃣  迁移用户 (users)...');
    let ok = 0, fail = 0;
    for (const row of data.users) {
        try {
            await prisma.user.upsert({
                where: { id: row.id },
                update: {},
                create: {
                    id: row.id,
                    username: row.username || null,
                    name: row.name || row.username || 'unknown',
                    passwordHash: row.passwordHash || null,
                    salt: row.salt || null,
                    role: row.role || 'student',
                    isAnonymous: Boolean(row.isAnonymous),
                }
            });
            ok++;
        } catch (e) { console.error(`  ❌ user ${row.id}: ${e.message}`); fail++; }
    }
    console.log(`  ✅ ${ok} 成功 / ${fail} 失败\n`);

    // ── 2. Courses ────────────────────────────────────────
    console.log('2️⃣  迁移课程 (courses)...');
    ok = 0; fail = 0;
    for (const row of data.courses) {
        const authorId = row.authorId || 'u_admin';
        // 确保 author 存在（容错）
        const authorExists = await prisma.user.findUnique({ where: { id: authorId } });
        if (!authorExists) {
            console.warn(`  ⚠️  课程 "${row.title}" 的作者 ${authorId} 不存在，跳过`);
            fail++; continue;
        }
        try {
            await prisma.course.upsert({
                where: { id: row.id },
                update: {},
                create: {
                    id: row.id,
                    title: row.title || '未命名课程',
                    description: row.description || null,
                    rawText: row.rawText || null,
                    graphData: safeJSON(row.graphData),
                    status: row.status || 'draft',
                    authorId: authorId,
                    createdAt: safeDate(row.createdAt),
                }
            });
            ok++;
        } catch (e) { console.error(`  ❌ course ${row.id}: ${e.message}`); fail++; }
    }
    console.log(`  ✅ ${ok} 成功 / ${fail} 失败\n`);

    // ── 3. Progress ───────────────────────────────────────
    console.log('3️⃣  迁移学习进度 (progress)...');

    // 先补全 progress 中引用但不存在的 user/course（孤立历史数据）
    const allUserIds = new Set((await prisma.user.findMany({ select: { id: true } })).map(u => u.id));
    const allCourseIds = new Set((await prisma.course.findMany({ select: { id: true } })).map(c => c.id));

    for (const row of data.progress) {
        if (!allUserIds.has(row.userId)) {
            await prisma.user.create({ data: { id: row.userId, name: `已删除用户_${row.userId.slice(-6)}`, role: 'student', isAnonymous: true } }).catch(() => {});
            allUserIds.add(row.userId);
        }
        if (!allCourseIds.has(row.courseId)) {
            await prisma.course.create({ data: { id: row.courseId, title: `已删除课程_${row.courseId}`, authorId: 'u_admin', status: 'hidden' } }).catch(() => {});
            allCourseIds.add(row.courseId);
        }
    }

    ok = 0; fail = 0;
    for (const row of data.progress) {
        try {
            await prisma.progress.upsert({
                where: { userId_courseId: { userId: row.userId, courseId: row.courseId } },
                update: { data: safeJSON(row.data) },
                create: {
                    userId: row.userId,
                    courseId: row.courseId,
                    data: safeJSON(row.data),
                }
            });
            ok++;
        } catch (e) { console.error(`  ❌ progress ${row.userId}/${row.courseId}: ${e.message}`); fail++; }
    }
    console.log(`  ✅ ${ok} 成功 / ${fail} 失败\n`);

    // ── 4. Content Cache ──────────────────────────────────
    console.log('4️⃣  迁移 AI 内容缓存 (content_cache，共 ' + data.content_cache.length + ' 条)...');

    // 补全 cache 中引用但不存在的 courseId
    for (const row of data.content_cache) {
        if (!allCourseIds.has(row.courseId)) {
            await prisma.course.create({ data: { id: row.courseId, title: `已删除课程_${row.courseId}`, authorId: 'u_admin', status: 'hidden' } }).catch(() => {});
            allCourseIds.add(row.courseId);
        }
    }

    ok = 0; fail = 0;
    const BATCH = 100;
    for (let i = 0; i < data.content_cache.length; i += BATCH) {
        const batch = data.content_cache.slice(i, i + BATCH);
        for (const row of batch) {
            try {
                await prisma.contentCache.upsert({
                    where: { courseId_nodeId_type: { courseId: row.courseId, nodeId: row.nodeId, type: row.type } },
                    update: {},
                    create: {
                        courseId: row.courseId,
                        nodeId: row.nodeId,
                        type: row.type,
                        data: row.data || null,
                        createdAt: safeDate(row.createdAt),
                    }
                });
                ok++;
            } catch (e) { fail++; }
        }
        process.stdout.write(`\r  进度: ${Math.min(i + BATCH, data.content_cache.length)}/${data.content_cache.length}`);
    }
    console.log(`\n  ✅ ${ok} 成功 / ${fail} 失败\n`);

    // ── 5. Course Permissions ─────────────────────────────
    console.log('5️⃣  迁移课程权限 (course_permissions)...');
    ok = 0; fail = 0;
    for (const row of data.course_permissions) {
        try {
            await prisma.coursePermission.upsert({
                where: { courseId_userId: { courseId: row.courseId, userId: row.userId } },
                update: {},
                create: {
                    courseId: row.courseId,
                    userId: row.userId,
                    permissionLevel: row.permissionLevel || 'member',
                    grantedBy: row.grantedBy || null,
                    grantedAt: safeDate(row.grantedAt),
                }
            });
            ok++;
        } catch (e) { console.error(`  ❌ permission: ${e.message}`); fail++; }
    }
    console.log(`  ✅ ${ok} 成功 / ${fail} 失败\n`);

    // ── 6. Settings ───────────────────────────────────────
    console.log('6️⃣  迁移系统设置 (settings)...');
    const s = data.settings[0];
    if (s) {
        await prisma.settings.upsert({
            where: { id: 1 },
            update: {},
            create: {
                id: 1,
                provider: s.provider || 'deepseek',
                deepseekApiKey: s.deepseekApiKey, deepseekModel: s.deepseekModel,
                zhipuApiKey: s.zhipuApiKey, zhipuModel: s.zhipuModel,
                ollamaBaseUrl: s.ollamaBaseUrl, ollamaModel: s.ollamaModel,
                qwenApiKey: s.qwenApiKey, qwenModel: s.qwenModel,
                geminiApiKey: s.geminiApiKey, geminiModel: s.geminiModel,
            }
        });
        console.log(`  ✅ 设置迁移成功，当前 AI 供应商: ${s.provider}\n`);
    }

    // ── 验证 ──────────────────────────────────────────────
    console.log('🔍 验证迁移结果：');
    const counts = {
        users: await prisma.user.count(),
        courses: await prisma.course.count(),
        progress: await prisma.progress.count(),
        content_cache: await prisma.contentCache.count(),
        course_permissions: await prisma.coursePermission.count(),
    };
    Object.entries(counts).forEach(([t, n]) => console.log(`  ${t.padEnd(22)}: ${n} 条`));
    console.log('\n✅ 迁移完成！');
    await prisma.$disconnect();
}

migrate().catch(async e => {
    console.error('迁移失败:', e);
    await prisma.$disconnect();
    process.exit(1);
});
