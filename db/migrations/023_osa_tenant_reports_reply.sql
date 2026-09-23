-- Add osa_reply to landlord_osa_tenant_reports

ALTER TABLE public.landlord_osa_tenant_reports
  ADD COLUMN IF NOT EXISTS osa_reply TEXT,
  ADD COLUMN IF NOT EXISTS osa_replied_at TIMESTAMPTZ;
