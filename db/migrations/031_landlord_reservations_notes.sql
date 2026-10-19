-- Add notes column to landlord_reservations for cancel remarks
ALTER TABLE public.landlord_reservations
  ADD COLUMN IF NOT EXISTS notes TEXT;
