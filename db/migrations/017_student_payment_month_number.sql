-- Add schedule_month_number to student_payment_records to track which rent schedule month student app payments are targeting.
ALTER TABLE public.student_payment_records
  ADD COLUMN IF NOT EXISTS schedule_month_number INT;
