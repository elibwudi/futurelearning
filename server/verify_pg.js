const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } } });
async function check() {
    const courses = await prisma.course.findMany({
        where: { status: 'ready' },
        select: { title: true, status: true },
        orderBy: { createdAt: 'desc' }
    });
    console.log('=== 已发布课程 (' + courses.length + ' 门) ===');
    courses.forEach(c => console.log(' -', c.title));
    const users = await prisma.user.findMany({ where: { isAnonymous: false, NOT: { role: 'student' } }, select: { username: true, role: true, name: true } });
    console.log('\n=== 教师/管理员账号 ===');
    users.forEach(u => console.log(` [${u.role}] ${u.username} - ${u.name}`));
    const cacheCount = await prisma.contentCache.count();
    const progressCount = await prisma.progress.count();
    console.log('\n=== 数量统计 ===');
    console.log('AI内容缓存:', cacheCount, '条');
    console.log('学习进度记录:', progressCount, '条');
    await prisma.$disconnect();
}
check().catch(e => { console.error(e); process.exit(1); });
