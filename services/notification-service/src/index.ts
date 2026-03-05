import { Elysia } from 'elysia';
import amqplib from 'amqplib';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from './db';
import { eventLogs, notifications } from './db/schema';
import { startConsumer } from './consumer';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const DLQ_EXCHANGE = 'suilens.dlq';
const DLQ_QUEUE = 'suilens.dlq';

let adminChannel: amqplib.Channel | null = null;

const getAdminChannel = async () => {
  if (adminChannel) return adminChannel;
  const connection = await amqplib.connect(RABBITMQ_URL);
  adminChannel = await connection.createChannel();
  await adminChannel.assertExchange(DLQ_EXCHANGE, 'topic', { durable: true });
  await adminChannel.assertQueue(DLQ_QUEUE, { durable: true });
  await adminChannel.bindQueue(DLQ_QUEUE, DLQ_EXCHANGE, '#');
  return adminChannel;
};

const ensureSchema = async () => {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL,
      type varchar(50) NOT NULL,
      recipient varchar(255) NOT NULL,
      message text NOT NULL,
      sent_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_order_type_idx
      ON notifications (order_id, type)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notification_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_name varchar(100) NOT NULL,
      payload jsonb NOT NULL,
      received_at timestamp NOT NULL DEFAULT now()
    )
  `);
};

const app = new Elysia()
  .get('/health', () => ({ status: 'ok', service: 'notification-service' }))
  .get('/admin/dlq', async ({ query }) => {
    const limit = Math.min(Number(query.limit) || 10, 50);
    const channel = await getAdminChannel();
    const messages = [] as Array<{
      routingKey: string;
      headers: Record<string, unknown>;
      payload: unknown;
    }>;

    for (let i = 0; i < limit; i += 1) {
      const msg = await channel.get(DLQ_QUEUE, { noAck: false });
      if (!msg) break;
      const payload = JSON.parse(msg.content.toString());
      messages.push({
        routingKey: msg.fields.routingKey,
        headers: (msg.properties.headers || {}) as Record<string, unknown>,
        payload,
      });
      channel.nack(msg, false, true);
    }

    return { count: messages.length, messages };
  })
  .post('/admin/notifications/replay', async ({ query }) => {
    const from = typeof query.from === 'string' ? query.from : '';
    const fromDate = new Date(from);
    if (!from || Number.isNaN(fromDate.getTime())) {
      return new Response(JSON.stringify({ error: 'Invalid from timestamp' }), { status: 400 });
    }

    const events = await db
      .select()
      .from(eventLogs)
      .where(and(eq(eventLogs.eventName, 'order.placed'), gte(eventLogs.receivedAt, fromDate)));

    let inserted = 0;
    for (const event of events) {
      const payload = event.payload as {
        orderId: string;
        customerName: string;
        customerEmail: string;
        lensName: string;
      };

      const existing = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.orderId, payload.orderId), eq(notifications.type, 'order_placed')));

      if (!existing[0]) {
        await db.insert(notifications).values({
          orderId: payload.orderId,
          type: 'order_placed',
          recipient: payload.customerEmail,
          message: `Hi ${payload.customerName}, your rental order for ${payload.lensName} has been placed successfully. Order ID: ${payload.orderId}`,
        });
        inserted += 1;
      }
    }

    return { processed: events.length, inserted };
  })
  .listen(3003);

ensureSchema()
  .then(() => startConsumer())
  .catch(console.error);

console.log(`Notification Service running on port ${app.server?.port}`);
