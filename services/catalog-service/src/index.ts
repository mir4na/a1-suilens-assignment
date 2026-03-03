import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { db } from './db';
import { lenses } from './db/schema';
import { eq } from 'drizzle-orm';

const app = new Elysia()
  .use(cors())
  .get('/api/lenses', async () => {
    return db.select().from(lenses);
  })
  .get('/api/lenses/:id', async ({ params }) => {
    const results = await db.select().from(lenses).where(eq(lenses.id, params.id));
    if (!results[0]) {
      return new Response(JSON.stringify({ error: 'Lens not found' }), { status: 404 });
    }
    return results[0];
  })
  .get('/health', () => ({ status: 'ok', service: 'catalog-service' }))
  .listen(3001);

console.log(`Catalog Service running on port ${app.server?.port}`);
