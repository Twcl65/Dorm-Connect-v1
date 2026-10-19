-- Add TerminatePending as a valid student reservation status
-- so student-initiated terminate requests stay visible in the active table.

ALTER TABLE public.student_dorm_reservations
  DROP CONSTRAINT IF EXISTS student_dorm_reservations_status_check;

ALTER TABLE public.student_dorm_reservations
  ADD CONSTRAINT student_dorm_reservations_status_check
  CHECK (status IN (
    'Pending',
    'Approved',
    'Confirmed',
    'Cancelled',
    'MoveOut',
    'TerminatePending'
  ));
