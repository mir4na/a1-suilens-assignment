import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from './db';
import { branches, inventory, reservations } from './db/schema';
import { startConsumer } from './consumer';

const app = new Elysia()
  .use(cors())
  .get('/api/inventory/lenses/:lensId', async ({ params }) => {
    const results = await db.select({
      branchCode: inventory.branchCode,
      branchName: branches.name,
      branchAddress: branches.address,
      availableQuantity: inventory.availableQuantity,
      totalQuantity: inventory.totalQuantity,
    })
      .from(inventory)
      .leftJoin(branches, eq(inventory.branchCode, branches.code))
      .where(eq(inventory.lensId, params.lensId));

    return results;
  })
  .post('/api/inventory/reserve', async ({ body }) => {
    const outcome = await db.transaction(async (tx) => {
      const existing = await tx.select().from(reservations).where(eq(reservations.orderId, body.orderId));
      if (existing[0]) {
        return { status: 'exists' as const, reservation: existing[0] };
      }

      const updated = await tx.update(inventory)
        .set({
          availableQuantity: sql`${inventory.availableQuantity} - ${body.quantity}`,
        })
        .where(and(
          eq(inventory.lensId, body.lensId),
          eq(inventory.branchCode, body.branchCode),
          gte(inventory.availableQuantity, body.quantity),
        ))
        .returning();

      if (!updated[0]) {
        return { status: 'insufficient' as const };
      }

      const created = await tx.insert(reservations)
        .values({
          orderId: body.orderId,
          lensId: body.lensId,
          branchCode: body.branchCode,
          quantity: body.quantity,
        })
        .returning();

      return { status: 'reserved' as const, reservation: created[0] };
    });

    if (outcome.status === 'insufficient') {
      return new Response(JSON.stringify({ error: 'Insufficient stock for selected branch' }), { status: 409 });
    }

    return { status: 'reserved', reservation: outcome.reservation };
  }, {
    body: t.Object({
      orderId: t.String({ format: 'uuid' }),
      lensId: t.String({ format: 'uuid' }),
      branchCode: t.String(),
      quantity: t.Number({ minimum: 1 }),
    }),
  })
  .get('/health', () => ({ status: 'ok', service: 'inventory-service' }))
  .listen(3004);

startConsumer().catch(console.error);

console.log(`Inventory Service running on port ${app.server?.port}`);
