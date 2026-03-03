import amqplib from 'amqplib';
import { db } from './db';
import { notifications } from './db/schema';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const EXCHANGE_NAME = 'suilens.events';
const QUEUE_NAME = 'notification-service.order-events';

export async function startConsumer() {
  const connection = await amqplib.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'order.*');

  console.log(`Notification Service listening on queue: ${QUEUE_NAME}`);

  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString());
      console.log(`Received event: ${event.event}`, event.data);

      if (event.event === 'order.placed') {
        const { orderId, customerName, customerEmail, lensName } = event.data;

        await db.insert(notifications).values({
          orderId,
          type: 'order_placed',
          recipient: customerEmail,
          message: `Hi ${customerName}, your rental order for ${lensName} has been placed successfully. Order ID: ${orderId}`,
        });

        console.log(`Notification recorded for order ${orderId}`);
      }

      channel.ack(msg);
    } catch (error) {
      console.error('Error processing message:', error);
      channel.nack(msg, false, true);
    }
  });
}
