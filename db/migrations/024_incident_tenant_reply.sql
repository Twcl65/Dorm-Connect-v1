-- Tenant reply on landlord incident response

ALTER TABLE public.dorm_incident_reports
  ADD COLUMN IF NOT EXISTS tenant_reply TEXT,
  ADD COLUMN IF NOT EXISTS tenant_replied_at TIMESTAMPTZ;
