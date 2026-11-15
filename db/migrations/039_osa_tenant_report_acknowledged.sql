ALTER TABLE public.landlord_osa_tenant_reports
  DROP CONSTRAINT IF EXISTS landlord_osa_tenant_reports_status_check;

ALTER TABLE public.landlord_osa_tenant_reports
  ADD CONSTRAINT landlord_osa_tenant_reports_status_check CHECK (
    status IN ('Open', 'Acknowledged', 'In Review', 'Resolved')
  );
