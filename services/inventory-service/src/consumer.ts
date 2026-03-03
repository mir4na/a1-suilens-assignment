import amqplib from 'amqplib';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from './db';
import { inventory, reservations } from './db/schema';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const EXCHANGE_NAME = 'suilens.events';
const QUEUE_NAME = 'inventory-service.order-events';

export async function startConsumer() {
  const connection = await amqplib.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'order.cancelled');

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
      channel.nack(msg, false, true);
    }
  });
}
