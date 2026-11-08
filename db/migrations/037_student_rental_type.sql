ALTER TABLE public.student_dorm_reservations
  ADD COLUMN IF NOT EXISTS rental_type TEXT NOT NULL DEFAULT 'Bedspace',
  ADD COLUMN IF NOT EXISTS beds_reserved INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.student_dorm_reservations
  DROP CONSTRAINT IF EXISTS student_dorm_reservations_rental_type_check,
  ADD CONSTRAINT student_dorm_reservations_rental_type_check
    CHECK (rental_type IN ('Bedspace', 'Whole room')),
  DROP CONSTRAINT IF EXISTS student_dorm_reservations_beds_reserved_check,
  ADD CONSTRAINT student_dorm_reservations_beds_reserved_check
    CHECK (beds_reserved >= 1);
