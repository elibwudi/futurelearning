import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://fl_app:fl1202_app_2026@localhost:5432/fl1202'

export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),
  migrate: {
    adapter: async () => {
      const { Pool } = await import('pg')
      const pool = new Pool({ connectionString: DATABASE_URL })
      return new PrismaPg(pool)
    }
  }
})
