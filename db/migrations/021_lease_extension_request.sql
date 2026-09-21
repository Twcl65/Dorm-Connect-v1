-- Student lease extension requests wait for landlord approval.
ALTER TABLE public.student_dorm_reservations
  ADD COLUMN IF NOT EXISTS lease_extension_requested_end DATE,
  ADD COLUMN IF NOT EXISTS lease_extension_status TEXT,
  ADD COLUMN IF NOT EXISTS lease_extension_requested_at TIMESTAMPTZ;
