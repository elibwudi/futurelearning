const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

async function check() {
    const courses = await prisma.course.findMany({
        where: { graphData: { contains: '## 符号主义' } }
    });
    console.log(`Found ${courses.length} courses with ## 符号主义 in graphData`);
    
    const coursesRaw = await prisma.course.findMany({
        where: { rawText: { contains: '## 符号主义' } }
    });
    console.log(`Found ${coursesRaw.length} courses with ## 符号主义 in rawText`);

    await prisma.$disconnect();
}
check();
