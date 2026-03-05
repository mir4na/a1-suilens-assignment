CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  type varchar(50) NOT NULL,
  recipient varchar(255) NOT NULL,
  message text NOT NULL,
  sent_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_order_type_idx
  ON notifications (order_id, type);

CREATE TABLE IF NOT EXISTS notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamp NOT NULL DEFAULT now()
);
