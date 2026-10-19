-- Add Completed as a valid lease payment status so approved move-outs can close the lease cleanly.

ALTER TABLE public.landlord_tenant_leases
  DROP CONSTRAINT IF EXISTS landlord_tenant_leases_payment_status_check;

ALTER TABLE public.landlord_tenant_leases
  ADD CONSTRAINT landlord_tenant_leases_payment_status_check
  CHECK (payment_status IN ('Paid', 'Pending', 'Overdue', 'Completed'));
