CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'active', 'returned', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name varchar(255) NOT NULL,
  customer_email varchar(255) NOT NULL,
  lens_id uuid NOT NULL,
  branch_code varchar(20) NOT NULL,
  lens_snapshot jsonb NOT NULL,
  start_date timestamp NOT NULL,
  end_date timestamp NOT NULL,
  total_price numeric(12,2) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT now()
);
