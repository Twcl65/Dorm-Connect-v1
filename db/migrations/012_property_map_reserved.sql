-- Landlord: rich property fields, map coords, gallery; room status Reserved;
-- Student reservations: extended booking form fields.

ALTER TABLE public.landlord_properties
  ADD COLUMN IF NOT EXISTS property_type TEXT NOT NULL DEFAULT 'Dormitory' CHECK (
    property_type IN ('Dormitory', 'Boarding House')
  ),
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_rooms INT,
  ADD COLUMN IF NOT EXISTS max_occupancy_capacity INT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS gallery_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.landlord_rooms
  DROP CONSTRAINT IF EXISTS landlord_rooms_status_check;

ALTER TABLE public.landlord_rooms
  ADD CONSTRAINT landlord_rooms_status_check CHECK (
    status IN ('Occupied', 'Available', 'Reserved', 'Maintenance')
  );

ALTER TABLE public.student_dorm_reservations
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS course TEXT,
  ADD COLUMN IF NOT EXISTS student_id_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS reservation_fee NUMERIC(12, 2) NOT NULL DEFAULT 0;
