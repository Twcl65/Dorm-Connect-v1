-- Allow Cancelled as a valid rent_payment_status on student_dorm_reservations
ALTER TABLE public.student_dorm_reservations
  DROP CONSTRAINT IF EXISTS student_dorm_reservations_rent_payment_status_check;

ALTER TABLE public.student_dorm_reservations
  ADD CONSTRAINT student_dorm_reservations_rent_payment_status_check CHECK (
    rent_payment_status IN ('Paid', 'Pending', 'Overdue', 'Cancelled')
  );
