import amqplib from 'amqplib';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from './db';
import { inventory, reservations } from './db/schema';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const EXCHANGE_NAME = 'suilens.events';
const QUEUE_NAME = 'inventory-service.order-events';
const DLQ_EXCHANGE = 'suilens.dlq';
const DLQ_QUEUE = 'suilens.dlq';

const getRetryCount = (headers: Record<string, unknown>) => {
  const raw = headers['x-retry'];
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const publishWithHeaders = async (
  channel: amqplib.Channel,
  exchange: string,
  routingKey: string,
  content: Buffer,
  headers: Record<string, unknown>
) => {
  channel.publish(exchange, routingKey, content, {
    persistent: true,
    contentType: 'application/json',
    headers,
  });
};

const handleFailure = async (channel: amqplib.Channel, msg: amqplib.ConsumeMessage) => {
  const headers = (msg.properties.headers || {}) as Record<string, unknown>;
  const retryCount = getRetryCount(headers);

  if (retryCount >= 3) {
    await publishWithHeaders(channel, DLQ_EXCHANGE, msg.fields.routingKey, msg.content, {
      ...headers,
      'x-retry': retryCount,
      'x-failed-at': new Date().toISOString(),
    });
    channel.ack(msg);
    return;
  }

  await publishWithHeaders(channel, EXCHANGE_NAME, msg.fields.routingKey, msg.content, {
    ...headers,
    'x-retry': retryCount + 1,
  });
  channel.ack(msg);
};

export async function startConsumer() {
  const connection = await amqplib.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'order.cancelled');

  await channel.assertExchange(DLQ_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(DLQ_QUEUE, { durable: true });
  await channel.bindQueue(DLQ_QUEUE, DLQ_EXCHANGE, '#');

  console.log(`Inventory Service listening on queue: ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      if (event.event === 'order.cancelled') {
        const { orderId } = event.data;

        await db.transaction(async (tx) => {
          const updated = await tx.update(reservations)
            .set({ releasedAt: new Date() })
            .where(and(eq(reservations.orderId, orderId), isNull(reservations.releasedAt)))
            .returning();

          if (!updated[0]) return;

          await tx.update(inventory)
            .set({
              availableQuantity: sql`${inventory.availableQuantity} + ${updated[0].quantity}`,
            })
            .where(and(
              eq(inventory.lensId, updated[0].lensId),
              eq(inventory.branchCode, updated[0].branchCode),
            ));
        });
      }

      channel.ack(msg);
    } catch (error) {
      console.error('Error processing message:', error);
      try {
        await handleFailure(channel, msg);
      } catch (publishError) {
        console.error('Error publishing retry:', publishError);
        channel.nack(msg, false, true);
      }
    }
  });
}
