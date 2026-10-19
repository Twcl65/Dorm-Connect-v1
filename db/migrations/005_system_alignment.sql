-- Align schema with DormConnect process: accreditation outcomes, OSA dorm oversight, announcement audiences.

-- Accreditation: distinguish terminal rejection vs. request for additional documents (replaces "Returned").
UPDATE public.landlord_accreditation_requests
SET status = 'Needs Documents'
WHERE status = 'Returned';

ALTER TABLE public.landlord_accreditation_requests
  DROP CONSTRAINT IF EXISTS landlord_accreditation_requests_status_check;

ALTER TABLE public.landlord_accreditation_requests
  ADD CONSTRAINT landlord_accreditation_requests_status_check CHECK (
    status IN (
      'Submitted',
      'In Review',
      'Approved',
      'Rejected',
      'Needs Documents'
    )
  );

-- OSA monitoring / safety: per-property operational and compliance flags (accredited dorms).
ALTER TABLE public.landlord_properties
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'Operating';

ALTER TABLE public.landlord_properties
  DROP CONSTRAINT IF EXISTS landlord_properties_operational_status_check;

ALTER TABLE public.landlord_properties
  ADD CONSTRAINT landlord_properties_operational_status_check CHECK (
    operational_status IN ('Operating', 'Not Operating', 'Under Inspection')
  );

ALTER TABLE public.landlord_properties
  ADD COLUMN IF NOT EXISTS compliance_status TEXT NOT NULL DEFAULT 'Compliant';

ALTER TABLE public.landlord_properties
  DROP CONSTRAINT IF EXISTS landlord_properties_compliance_status_check;

ALTER TABLE public.landlord_properties
  ADD CONSTRAINT landlord_properties_compliance_status_check CHECK (
    compliance_status IN ('Compliant', 'Warning', 'Non-Compliant')
  );

ALTER TABLE public.landlord_properties
  ADD COLUMN IF NOT EXISTS last_inspection_at TIMESTAMPTZ;

-- Announcements: OSA targets students, landlords, or both.
ALTER TABLE public.student_announcements
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'Students';

ALTER TABLE public.student_announcements
  DROP CONSTRAINT IF EXISTS student_announcements_audience_check;

ALTER TABLE public.student_announcements
  ADD CONSTRAINT student_announcements_audience_check CHECK (
    audience IN ('Students', 'Landlords', 'All')
  );

ALTER TABLE public.student_announcements
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.boarding_house_app_users (id) ON DELETE SET NULL;
