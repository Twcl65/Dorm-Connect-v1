-- Payment Monitoring System: Monthly payment tracking and initial payment requirements

-- Extend student_dorm_reservations to track initial payment requirement
ALTER TABLE public.student_dorm_reservations
ADD COLUMN IF NOT EXISTS initial_payment_required NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS initial_payment_received NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS requires_initial_payment_validation BOOLEAN DEFAULT true;

-- New table: Monthly payment due dates and tracking
CREATE TABLE IF NOT EXISTS public.payment_due_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.student_dorm_reservations (id) ON DELETE CASCADE,
  month_number INT NOT NULL CHECK (month_number >= 1),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Yet Paid' CHECK (status IN ('Paid', 'Not Yet Paid')),
  amount_due NUMERIC(12, 2) NOT NULL,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, month_number)
);

CREATE INDEX IF NOT EXISTS idx_payment_due_dates_reservation ON public.payment_due_dates (reservation_id);
CREATE INDEX IF NOT EXISTS idx_payment_due_dates_status ON public.payment_due_dates (status);
CREATE INDEX IF NOT EXISTS idx_payment_due_dates_due_date ON public.payment_due_dates (due_date);
