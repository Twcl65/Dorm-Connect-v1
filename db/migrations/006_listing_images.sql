-- Room listing photos for student browse (URLs stored after upload).
ALTER TABLE public.landlord_rooms
  ADD COLUMN IF NOT EXISTS listing_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
