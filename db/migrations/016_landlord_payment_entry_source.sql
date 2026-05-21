-- Distinguish manual cash, advance credit, and security deposit entries in payment history.

ALTER TABLE public.landlord_payments
  ADD COLUMN IF NOT EXISTS entry_source TEXT CHECK (
    entry_source IS NULL
    OR entry_source IN ('manual', 'advance', 'deposit')
  );

ALTER TABLE public.landlord_payments
  ADD COLUMN IF NOT EXISTS schedule_month_number INT;
