-- Landlord module: scoped by boarding_house_app_users.id (Owner role)

CREATE TABLE IF NOT EXISTS public.landlord_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  operational_status TEXT NOT NULL DEFAULT 'Operating' CHECK (
    operational_status IN ('Operating', 'Not Operating', 'Under Inspection')
  ),
  compliance_status TEXT NOT NULL DEFAULT 'Compliant' CHECK (
    compliance_status IN ('Compliant', 'Warning', 'Non-Compliant')
  ),
  last_inspection_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landlord_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.landlord_properties (id) ON DELETE CASCADE,
  room_no TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  monthly_rate NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (
    status IN ('Occupied', 'Available', 'Maintenance')
  ),
  remarks TEXT,
  is_listed BOOLEAN NOT NULL DEFAULT false,
  listing_location TEXT,
  listing_description TEXT,
  listing_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, room_no)
);

CREATE TABLE IF NOT EXISTS public.landlord_tenant_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.landlord_properties (id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.landlord_rooms (id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  lease_start DATE NOT NULL,
  lease_end DATE NOT NULL,
  payment_status TEXT NOT NULL CHECK (
    payment_status IN ('Paid', 'Pending', 'Overdue')
  ),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landlord_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.landlord_properties (id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.landlord_rooms (id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  email TEXT,
  contact TEXT,
  lease_start DATE NOT NULL,
  lease_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('Confirmed', 'Pending', 'Cancelled')
  ),
  payment_method TEXT,
  amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reference_no TEXT,
  proof_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landlord_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.landlord_rooms (id) ON DELETE SET NULL,
  tenant_lease_id UUID REFERENCES public.landlord_tenant_leases (id) ON DELETE SET NULL,
  payer_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  method TEXT NOT NULL CHECK (
    method IN ('GCash', 'Cash', 'Bank Transfer')
  ),
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Pending', 'Overdue')),
  reference_no TEXT,
  proof_url TEXT,
  paid_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landlord_accreditation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.landlord_properties (id) ON DELETE SET NULL,
  dorm_name TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (
    status IN (
      'Submitted',
      'In Review',
      'Approved',
      'Rejected',
      'Needs Documents'
    )
  ),
  documents_count INT NOT NULL DEFAULT 0,
  form_data JSONB,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landlord_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lp_owner ON public.landlord_properties (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lr_owner ON public.landlord_rooms (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ltl_owner ON public.landlord_tenant_leases (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lres_owner ON public.landlord_reservations (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lpay_owner ON public.landlord_payments (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lacc_owner ON public.landlord_accreditation_requests (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_lact_owner ON public.landlord_activity_log (owner_user_id);
