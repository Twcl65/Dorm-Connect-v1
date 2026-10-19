-- Move-out workflow and reservation history for student reservations

-- 1) Allow a new terminal status for student reservations.
ALTER TABLE public.student_dorm_reservations
  DROP CONSTRAINT IF EXISTS student_dorm_reservations_status_check;

ALTER TABLE public.student_dorm_reservations
  ADD CONSTRAINT student_dorm_reservations_status_check CHECK (
    status IN ('Pending', 'Confirmed', 'Cancelled', 'MoveOut')
  );

-- 2) Record when the move-out was finalized and the actual move-out date.
ALTER TABLE public.student_dorm_reservations
  ADD COLUMN IF NOT EXISTS move_out_date DATE,
  ADD COLUMN IF NOT EXISTS moved_out_at TIMESTAMPTZ;

-- 3) Immutable history table for ended student reservations.
CREATE TABLE IF NOT EXISTS public.student_reservation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.student_dorm_reservations (id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.landlord_properties (id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.landlord_rooms (id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL,
  lease_start DATE NOT NULL,
  lease_end DATE NOT NULL,
  move_out_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('MoveOut', 'Cancelled')),
  rent_payment_status TEXT NOT NULL DEFAULT 'Pending',
  advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_remaining NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ended_by TEXT NOT NULL CHECK (ended_by IN ('tenant', 'landlord', 'system')),
  ended_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_srh_reservation
  ON public.student_reservation_history (reservation_id);

CREATE INDEX IF NOT EXISTS idx_srh_student
  ON public.student_reservation_history (student_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_srh_property
  ON public.student_reservation_history (property_id, created_at DESC);
