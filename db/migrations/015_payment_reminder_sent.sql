-- Track landlord payment reminders per schedule month (one notify per unpaid month).

ALTER TABLE public.payment_due_dates
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
