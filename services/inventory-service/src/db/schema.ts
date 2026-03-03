import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const branches = pgTable('branches', {
  code: varchar('code', { length: 20 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }).notNull(),
  notes: varchar('notes', { length: 255 }),
});

export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  lensId: uuid('lens_id').notNull(),
  branchCode: varchar('branch_code', { length: 20 }).notNull(),
  totalQuantity: integer('total_quantity').notNull(),
  availableQuantity: integer('available_quantity').notNull(),
});

export const reservations = pgTable('inventory_reservations', {
  orderId: uuid('order_id').primaryKey(),
  lensId: uuid('lens_id').notNull(),
  branchCode: varchar('branch_code', { length: 20 }).notNull(),
  quantity: integer('quantity').notNull(),
  reservedAt: timestamp('reserved_at').defaultNow().notNull(),
  releasedAt: timestamp('released_at'),
});
