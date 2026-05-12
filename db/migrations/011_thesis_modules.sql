-- Thesis module alignment: role labels, ICT verification, accreditation workflow,
-- inspections, in-app notifications, payment schedule fields.

-- 1) Roles: Owner → Landlord, OSA Admin → OSA/SAS Admin
ALTER TABLE public.boarding_house_app_users
  DROP CONSTRAINT IF EXISTS boarding_house_app_users_role_check;

UPDATE public.boarding_house_app_users
SET role = 'Landlord'
WHERE role = 'Owner';

UPDATE public.boarding_house_app_users
SET role = 'OSA/SAS Admin'
WHERE role = 'OSA Admin';

ALTER TABLE public.boarding_house_app_users
  ADD CONSTRAINT boarding_house_app_users_role_check CHECK (
    role IN ('Student', 'Landlord', 'ICT Admin', 'OSA/SAS Admin')
  );

-- 2) ICT verification (primarily students/tenants)
ALTER TABLE public.boarding_house_app_users
  ADD COLUMN IF NOT EXISTS ict_verification_status TEXT NOT NULL DEFAULT 'Verified';

ALTER TABLE public.boarding_house_app_users
  DROP CONSTRAINT IF EXISTS boarding_house_app_users_ict_verification_status_check;

ALTER TABLE public.boarding_house_app_users
  ADD CONSTRAINT boarding_house_app_users_ict_verification_status_check CHECK (
    ict_verification_status IN ('Pending Verification', 'Verified', 'Rejected')
  );

UPDATE public.boarding_house_app_users
SET ict_verification_status = 'Verified'
WHERE role <> 'Student';

UPDATE public.boarding_house_app_users
SET ict_verification_status = 'Verified'
WHERE role = 'Student';

-- 3) Student profile extensions
ALTER TABLE public.boarding_house_app_users
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS course TEXT;

-- 4) Property map link (e.g. Google Maps)
ALTER TABLE public.landlord_properties
  ADD COLUMN IF NOT EXISTS map_embed_url TEXT;

-- 5) Accreditation: expanded statuses + expiry / inspection scheduling
ALTER TABLE public.landlord_accreditation_requests
  DROP CONSTRAINT IF EXISTS landlord_accreditation_requests_status_check;

UPDATE public.landlord_accreditation_requests
SET status = CASE
  WHEN status IN ('Submitted', 'In Review') THEN 'Pending'
  WHEN status = 'Needs Documents' THEN 'Hold'
  ELSE status
END;

ALTER TABLE public.landlord_accreditation_requests
  ADD COLUMN IF NOT EXISTS accreditation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_scheduled_for DATE,
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at TIMESTAMPTZ;

UPDATE public.landlord_accreditation_requests
SET accreditation_expires_at = submitted_at + interval '1 year'
WHERE status = 'Approved'
  AND accreditation_expires_at IS NULL;

ALTER TABLE public.landlord_accreditation_requests
  ADD CONSTRAINT landlord_accreditation_requests_status_check CHECK (
    status IN (
      'Pending',
      'Scheduled for Inspection',
      'Recommended for Approval',
      'Hold',
      'Rejected',
      'Approved',
      'Expired'
    )
  );

-- 6) OSA inspections + checklist payload
CREATE TABLE IF NOT EXISTS public.os_accredit_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accreditation_request_id UUID NOT NULL REFERENCES public.landlord_accreditation_requests (id) ON DELETE CASCADE,
  scheduled_for DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  result TEXT CHECK (
    result IS NULL OR result IN ('Recommended for Approval', 'Hold', 'Rejected')
  ),
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_insp_acc
  ON public.os_accredit_inspections (accreditation_request_id);

-- 7) Notifications
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notif_user
  ON public.app_notifications (user_id, created_at DESC);

-- 8) Student reservation payment breakdown
ALTER TABLE public.student_dorm_reservations
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_remaining NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_payment_due_date DATE;

-- Initialize balance from monthly rent where missing
UPDATE public.student_dorm_reservations
SET balance_remaining = monthly_rent
WHERE balance_remaining = 0
  AND monthly_rent > 0;
