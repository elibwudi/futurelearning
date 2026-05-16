const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202' } }
});

async function check() {
    const settings = await prisma.settings.findFirst();
    console.log("Current Settings:", settings);
    await prisma.$disconnect();
}
check();
