-- Profile images for all app users; align placeholder property names with accreditation

ALTER TABLE public.boarding_house_app_users
  ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- One-time: set property display name from latest approved accreditation where still default
UPDATE public.landlord_properties p
SET name = sub.dorm_name,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (a.property_id)
    a.property_id,
    a.dorm_name
  FROM public.landlord_accreditation_requests a
  WHERE a.status = 'Approved'
    AND a.property_id IS NOT NULL
    AND trim(a.dorm_name) <> ''
  ORDER BY a.property_id, a.submitted_at DESC
) AS sub
WHERE p.id = sub.property_id
  AND lower(trim(p.name)) IN ('my property', '');
