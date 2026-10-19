-- Student module: scoped by boarding_house_app_users.id (Student role)

CREATE TABLE IF NOT EXISTS public.student_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  audience TEXT NOT NULL DEFAULT 'Students' CHECK (
    audience IN ('Students', 'Landlords', 'All')
  ),
  created_by_user_id UUID REFERENCES public.boarding_house_app_users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.student_dorm_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.landlord_rooms (id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  lease_start DATE NOT NULL,
  lease_end DATE NOT NULL,
  monthly_rent NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (
    status IN ('Pending', 'Confirmed', 'Cancelled')
  ),
  rent_payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (
    rent_payment_status IN ('Paid', 'Pending', 'Overdue')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.student_dorm_reservations (id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Pending', 'Failed')),
  paid_at TIMESTAMPTZ,
  receipt_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_dorm_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.boarding_house_app_users (id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.landlord_rooms (id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_sann_active ON public.student_announcements (is_active, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sres_student ON public.student_dorm_reservations (student_user_id);
CREATE INDEX IF NOT EXISTS idx_sres_room ON public.student_dorm_reservations (room_id);
CREATE INDEX IF NOT EXISTS idx_spay_student ON public.student_payment_records (student_user_id);
CREATE INDEX IF NOT EXISTS idx_srev_room ON public.student_dorm_reviews (room_id);

INSERT INTO public.student_announcements (title, body, posted_at)
SELECT v.title, v.body, v.posted_at::timestamptz
FROM (
  VALUES
    (
      'Dorm accreditation renewal schedule',
      'OSA will conduct on-site inspections for accredited dorms this March. Please keep common areas accessible.',
      '2026-03-05 08:00:00+00'
    ),
    (
      'Midterm exam quiet hours',
      'Please observe quiet hours from 9:00 PM to 6:00 AM during midterms week.',
      '2026-03-02 08:00:00+00'
    )
) AS v(title, body, posted_at)
WHERE NOT EXISTS (SELECT 1 FROM public.student_announcements LIMIT 1);
