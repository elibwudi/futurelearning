const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

async function check() {
    // Just fetch all and check in memory
    const courses = await prisma.course.findMany();
    let found = 0;
    courses.forEach(c => {
        const gd = JSON.stringify(c.graphData || {});
        if (gd.includes('## 符号主义')) {
            found++;
            console.log(`Course ${c.id} has ## 符号主义 in graphData!`);
        }
        if (c.rawText && c.rawText.includes('## 符号主义')) {
            console.log(`Course ${c.id} has ## 符号主义 in rawText!`);
        }
    });
    console.log(`Checked ${courses.length} courses, found ${found} matches.`);
    await prisma.$disconnect();
}
check();
