const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

async function check() {
    const records = await prisma.contentCache.findMany({
        where: { data: { contains: '符号主义' } }
    });
    console.log(`Found ${records.length} records`);
    records.forEach(r => console.log(`ID: ${r.id}, Type: ${r.type}, Data Length: ${r.data.length}, Preview: ${r.data.substring(0, 100)}`));
    await prisma.$disconnect();
}
check();
