const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

async function check() {
    const record = await prisma.contentCache.findFirst({
        where: { data: { contains: 'AI主要学派' } }
    });
    console.log(record ? "RAW DATA:\n" + record.data : 'No records found');
    await prisma.$disconnect();
}
check();
