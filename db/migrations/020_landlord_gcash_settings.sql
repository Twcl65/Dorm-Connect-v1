-- Landlord GCash receiving details shown to students when paying
ALTER TABLE public.boarding_house_app_users
  ADD COLUMN IF NOT EXISTS gcash_account_name TEXT,
  ADD COLUMN IF NOT EXISTS gcash_phone TEXT,
  ADD COLUMN IF NOT EXISTS gcash_qr_code_url TEXT;
