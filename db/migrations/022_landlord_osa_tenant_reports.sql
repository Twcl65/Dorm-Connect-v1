CREATE TABLE IF NOT EXISTS public.landlord_osa_tenant_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  lease_id UUID REFERENCES public.landlord_tenant_leases (id) ON DELETE SET NULL,
  student_user_id UUID REFERENCES public.boarding_house_app_users (id) ON DELETE SET NULL,
  tenant_name TEXT NOT NULL,
  room_no TEXT,
  property_name TEXT,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (
    status IN ('Open', 'In Review', 'Resolved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_osa_tenant_reports_created
  ON public.landlord_osa_tenant_reports (created_at DESC);
