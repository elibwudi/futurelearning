const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

async function check() {
    const record = await prisma.contentCache.findFirst({
        where: { data: { contains: '**' } }
    });
    console.log(record ? "Raw Data:" + record.data.substring(0, 500) : 'No records found');
    await prisma.$disconnect();
}
check();
