-- Dorm Connect: application users managed from ICT admin (not auth.users)
CREATE TABLE IF NOT EXISTS public.boarding_house_app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_id SERIAL UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (
    role IN ('Student', 'Owner', 'ICT Admin', 'OSA Admin')
  ),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (
    status IN ('Active', 'Pending', 'Inactive')
  ),
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_boarding_house_app_users_email
  ON public.boarding_house_app_users (lower(email));
