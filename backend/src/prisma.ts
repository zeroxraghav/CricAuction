import { PrismaClient } from '@prisma/client';

let dbUrl = process.env.DATABASE_URL;
// Ensure pgbouncer=true is appended for transaction pooling compatibility (Render/Supabase)
if (dbUrl && !dbUrl.includes('pgbouncer=true')) {
  dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});
