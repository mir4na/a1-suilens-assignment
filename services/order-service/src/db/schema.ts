import { pgTable, uuid, varchar, numeric, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'confirmed', 'active', 'returned', 'cancelled',
]);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerEmail: varchar('customer_email', { length: 255 }).notNull(),
  lensId: uuid('lens_id').notNull(),
  branchCode: varchar('branch_code', { length: 20 }).notNull(),
  lensSnapshot: jsonb('lens_snapshot').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
  status: orderStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
