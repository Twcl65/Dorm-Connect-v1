-- Landlord messages to tenants at a property (all booked tenants or one student).

CREATE TABLE IF NOT EXISTS public.landlord_tenant_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.landlord_properties (id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('all_booked', 'single_student')),
  target_student_user_id UUID REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT landlord_tenant_ann_audience_target CHECK (
    (audience = 'single_student' AND target_student_user_id IS NOT NULL)
    OR (audience = 'all_booked' AND target_student_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_lta_owner_created
  ON public.landlord_tenant_announcements (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lta_property
  ON public.landlord_tenant_announcements (property_id, created_at DESC);
