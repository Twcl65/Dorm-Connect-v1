-- ICT: student school ID; room media & listing cover; payment proof; incident reports

ALTER TABLE public.boarding_house_app_users
  ADD COLUMN IF NOT EXISTS student_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_boarding_users_student_id_unique
  ON public.boarding_house_app_users (student_id)
  WHERE student_id IS NOT NULL AND trim(student_id) <> '';

ALTER TABLE public.landlord_rooms
  ADD COLUMN IF NOT EXISTS room_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS room_size_label TEXT,
  ADD COLUMN IF NOT EXISTS room_details TEXT,
  ADD COLUMN IF NOT EXISTS listing_background_url TEXT;

ALTER TABLE public.student_payment_records
  ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

CREATE TABLE IF NOT EXISTS public.dorm_incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.landlord_rooms (id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.landlord_properties (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (
    status IN ('Open', 'Acknowledged', 'Resolved')
  ),
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dorm_inc_owner ON public.dorm_incident_reports (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dorm_inc_reporter ON public.dorm_incident_reports (reporter_user_id, created_at DESC);
