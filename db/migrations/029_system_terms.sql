-- System-wide Terms & Conditions table (editable by landlord).
-- Sections: overview, paymentAndRemoval, consequences, examples

CREATE TABLE IF NOT EXISTS public.system_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Terms & Conditions',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.boarding_house_app_users (id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.boarding_house_app_users (id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.system_terms (title, content, is_active, version, created_at, updated_at)
SELECT
  'Terms & Conditions',
  jsonb_build_object(
    'overview', 'These terms and conditions govern the use of the Dorm-Connect platform by students/tenants and landlords.',
    'paymentAndRemoval', 'Rent must be paid on or before the due date. Late payments may incur penalties. Failure to pay rent for 7 consecutive days may result in removal from the dormitory.',
    'consequences', 'Violation of these terms may lead to account suspension, removal from the dormitory, or other actions deemed necessary by the landlord and/or OSA.',
    'examples', 'Examples of violations include: (1) smoking in non-designated areas, (2) damaging property, (3) disturbing neighbors after quiet hours, (4) subletting without permission, (5) non-payment of rent.'
  ),
  true,
  1,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.system_terms);
