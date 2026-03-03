CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS lenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name varchar(255) NOT NULL,
  manufacturer_name varchar(255) NOT NULL,
  min_focal_length integer NOT NULL,
  max_focal_length integer NOT NULL,
  max_aperture numeric(4,1) NOT NULL,
  mount_type varchar(50) NOT NULL,
  day_price numeric(12,2) NOT NULL,
  weekend_price numeric(12,2) NOT NULL,
  description text
);

INSERT INTO lenses (id, model_name, manufacturer_name, min_focal_length, max_focal_length, max_aperture, mount_type, day_price, weekend_price, description)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'FE 24-70mm F2.8 GM II', 'Sony', 24, 70, 2.8, 'Sony E', 250000, 600000, 'The Sony FE 24-70mm F2.8 GM II is a fast, versatile zoom lens.'),
  ('22222222-2222-2222-2222-222222222222', 'FE 70-200mm F2.8 GM OSS II', 'Sony', 70, 200, 2.8, 'Sony E', 350000, 800000, 'The Sony FE 70-200mm F2.8 GM OSS II is a telephoto zoom lens.')
ON CONFLICT (id) DO NOTHING;
