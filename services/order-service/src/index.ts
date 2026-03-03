import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { db } from './db';
import { orders } from './db/schema';
import { eq } from 'drizzle-orm';
import { publishEvent } from './events';

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3001';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3004';

interface CatalogLens {
  id: string;
  modelName: string;
  manufacturerName: string;
  dayPrice: string;
}

const app = new Elysia()
  .use(cors())
  .post('/api/orders', async ({ body }) => {
    const lensResponse = await fetch(`${CATALOG_SERVICE_URL}/api/lenses/${body.lensId}`);
    if (!lensResponse.ok) {
      return new Response(JSON.stringify({ error: 'Lens not found' }), { status: 404 });
    }
    const lens = await lensResponse.json() as CatalogLens;

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) {
      return new Response(
        JSON.stringify({ error: 'End date must be after start date' }),
        { status: 400 }
      );
    }
    const totalPrice = (days * parseFloat(lens.dayPrice)).toFixed(2);
    const orderId = crypto.randomUUID();

    const reserveResponse = await fetch(`${INVENTORY_SERVICE_URL}/api/inventory/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        lensId: body.lensId,
        branchCode: body.branchCode,
        quantity: 1,
      }),
    });

    if (reserveResponse.status === 409) {
      const payload = await reserveResponse.json().catch(() => ({ error: 'Insufficient stock' }));
      return new Response(JSON.stringify(payload), { status: 409 });
    }

    if (!reserveResponse.ok) {
      const payload = await reserveResponse.json().catch(() => ({ error: 'Inventory service unavailable' }));
      return new Response(JSON.stringify(payload), { status: 502 });
    }

    const [order] = await db.insert(orders).values({
      id: orderId,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      lensId: body.lensId,
      branchCode: body.branchCode,
      lensSnapshot: {
        modelName: lens.modelName,
        manufacturerName: lens.manufacturerName,
        dayPrice: lens.dayPrice,
      },
      startDate: start,
      endDate: end,
      totalPrice,
      status: 'confirmed',
    }).returning();
    if (!order) {
      await publishEvent('order.cancelled', {
        orderId,
        lensId: body.lensId,
        branchCode: body.branchCode,
        quantity: 1,
      });
      return new Response(JSON.stringify({ error: 'Failed to create order' }), { status: 500 });
    }

    await publishEvent('order.placed', {
      orderId: order.id,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      lensName: lens.modelName,
    });

    return new Response(JSON.stringify(order), { status: 201 });
  }, {
    body: t.Object({
      customerName: t.String(),
      customerEmail: t.String({ format: 'email' }),
      lensId: t.String({ format: 'uuid' }),
      branchCode: t.String(),
      startDate: t.String(),
      endDate: t.String(),
    }),
  })
  .get('/api/orders', async () => db.select().from(orders))
  .get('/api/orders/:id', async ({ params }) => {
    const results = await db.select().from(orders).where(eq(orders.id, params.id));
    if (!results[0]) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }
    return results[0];
  })
  .patch('/api/orders/:id/cancel', async ({ params }) => {
    const results = await db.select().from(orders).where(eq(orders.id, params.id));
    if (!results[0]) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 404 });
    }

    const existing = results[0];
    if (existing.status !== 'cancelled') {
      const [updated] = await db.update(orders)
        .set({ status: 'cancelled' })
        .where(eq(orders.id, params.id))
        .returning();

      if (!updated) {
        return new Response(JSON.stringify({ error: 'Failed to cancel order' }), { status: 500 });
      }

      await publishEvent('order.cancelled', {
        orderId: updated.id,
        lensId: updated.lensId,
        branchCode: updated.branchCode,
        quantity: 1,
      });

      return updated;
    }

    return existing;
  })
  .get('/health', () => ({ status: 'ok', service: 'order-service' }))
  .listen(3002);

console.log(`Order Service running on port ${app.server?.port}`);
