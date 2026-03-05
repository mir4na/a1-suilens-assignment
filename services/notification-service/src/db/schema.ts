import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  recipient: varchar('recipient', { length: 255 }).notNull(),
  message: text('message').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

export const eventLogs = pgTable('notification_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventName: varchar('event_name', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
});
