-- Link monthly due dates to manual landlord leases (not only student reservations)

ALTER TABLE public.payment_due_dates
  ALTER COLUMN reservation_id DROP NOT NULL;

ALTER TABLE public.payment_due_dates
  ADD COLUMN IF NOT EXISTS tenant_lease_id UUID REFERENCES public.landlord_tenant_leases (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_due_dates_lease_month
  ON public.payment_due_dates (tenant_lease_id, month_number)
  WHERE tenant_lease_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_due_dates_res_or_lease'
  ) THEN
    ALTER TABLE public.payment_due_dates
      ADD CONSTRAINT payment_due_dates_res_or_lease CHECK (
        (reservation_id IS NOT NULL AND tenant_lease_id IS NULL)
        OR (reservation_id IS NULL AND tenant_lease_id IS NOT NULL)
      );
  END IF;
END $$;
