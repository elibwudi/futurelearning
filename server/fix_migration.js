/**
 * 补录：修复 t1 用户信息 + 迁移 t1 所属课程（去除非法字符）
 */
const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

// 清洗 NULL 字节
function cleanStr(s) {
    if (!s) return null;
    return s.replace(/\x00/g, '');
}
function safeJSON(s) {
    const c = cleanStr(s);
    if (!c) return null;
    try { return JSON.parse(c); } catch { return null; }
}
function safeDate(ts) {
    if (!ts) return new Date();
    return ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
}

async function main() {
    // 1. 修复 t1 用户角色
    await prisma.user.update({
        where: { id: 't1' },
        data: { name: '默认教师(旧)', role: 'teacher' }
    });
    console.log('✅ t1 用户角色已修正为 teacher');

    // 2. 从 SQLite 读取 t1 的课程并补录
    const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
    await new Promise((resolve) => {
        db.all("SELECT * FROM courses WHERE authorId='t1'", async (err, rows) => {
            console.log(`\n补录 t1 的课程 ${rows.length} 门:`);
            for (const row of rows) {
                try {
                    await prisma.course.upsert({
                        where: { id: row.id },
                        update: {},
                        create: {
                            id: row.id,
                            title: cleanStr(row.title) || '未命名',
                            description: cleanStr(row.description),
                            rawText: cleanStr(row.rawText),
                            graphData: safeJSON(row.graphData),
                            status: row.status || 'draft',
                            authorId: 't1',
                            createdAt: safeDate(row.createdAt),
                        }
                    });
                    console.log('  ✅', row.title);
                } catch (e) {
                    console.error('  ❌', row.title, '-', e.message.slice(0, 100));
                }
            }
            db.close();
            resolve();
        });
    });

    // 3. 最终计数验证
    const counts = {
        users: await prisma.user.count(),
        courses: await prisma.course.count(),
        progress: await prisma.progress.count(),
        content_cache: await prisma.contentCache.count(),
        permissions: await prisma.coursePermission.count(),
    };
    console.log('\n=== 最终 PostgreSQL 数据量 ===');
    Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(20)}: ${v} 条`));

    await prisma.$disconnect();
}

main().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
});
