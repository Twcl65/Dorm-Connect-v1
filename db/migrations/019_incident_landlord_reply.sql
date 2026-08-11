-- Landlord reply on student incident reports

ALTER TABLE public.dorm_incident_reports
  ADD COLUMN IF NOT EXISTS landlord_reply TEXT,
  ADD COLUMN IF NOT EXISTS landlord_replied_at TIMESTAMPTZ;
