-- Link landlord tenant lease rows to student reservations for idempotent sync when payments update.

ALTER TABLE public.landlord_tenant_leases
  ADD COLUMN IF NOT EXISTS student_reservation_id UUID REFERENCES public.student_dorm_reservations (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ltl_student_reservation_id
  ON public.landlord_tenant_leases (student_reservation_id);
