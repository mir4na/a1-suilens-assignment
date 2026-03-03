CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS branches (
  code varchar(20) PRIMARY KEY,
  name varchar(255) NOT NULL,
  address varchar(255) NOT NULL,
  notes varchar(255)
);

CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lens_id uuid NOT NULL,
  branch_code varchar(20) NOT NULL REFERENCES branches(code),
  total_quantity integer NOT NULL,
  available_quantity integer NOT NULL,
  UNIQUE (lens_id, branch_code)
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  order_id uuid PRIMARY KEY,
  lens_id uuid NOT NULL,
  branch_code varchar(20) NOT NULL,
  quantity integer NOT NULL,
  reserved_at timestamp NOT NULL DEFAULT now(),
  released_at timestamp
);

INSERT INTO branches (code, name, address, notes)
VALUES
  ('KB-JKT-S', 'Kebayoran Baru', 'Jakarta Selatan', 'Studio utama, inventaris terbesar'),
  ('KB-JKT-E', 'Jatinegara', 'Jakarta Timur', 'Cabang sekunder'),
  ('KB-JKT-N', 'Kelapa Gading', 'Jakarta Utara', 'Cabang terbaru, stok terbatas')
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory (lens_id, branch_code, total_quantity, available_quantity)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'KB-JKT-S', 4, 4),
  ('11111111-1111-1111-1111-111111111111', 'KB-JKT-E', 2, 2),
  ('11111111-1111-1111-1111-111111111111', 'KB-JKT-N', 1, 1),
  ('22222222-2222-2222-2222-222222222222', 'KB-JKT-S', 3, 3),
  ('22222222-2222-2222-2222-222222222222', 'KB-JKT-E', 1, 1),
  ('22222222-2222-2222-2222-222222222222', 'KB-JKT-N', 0, 0)
ON CONFLICT (lens_id, branch_code) DO NOTHING;
