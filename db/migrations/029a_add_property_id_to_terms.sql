-- Add property_id to system_terms to support per-property terms and conditions

-- Add property_id column (nullable for system-wide terms, non-null for property-specific)
ALTER TABLE public.system_terms ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.landlord_properties(id) ON DELETE CASCADE;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_system_terms_property_id ON public.system_terms(property_id);
CREATE INDEX IF NOT EXISTS idx_system_terms_active_property ON public.system_terms(is_active, property_id);

-- Add trigger to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_system_terms_updated_at ON public.system_terms;
CREATE TRIGGER update_system_terms_updated_at
BEFORE UPDATE ON public.system_terms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one active system-wide terms (property_id IS NULL)
DROP INDEX IF EXISTS public.idx_system_terms_single_active_systemwide;
CREATE UNIQUE INDEX idx_system_terms_single_active_systemwide
ON public.system_terms((1))
WHERE is_active = true AND property_id IS NULL;

-- Ensure only one active terms per property
DROP INDEX IF EXISTS public.idx_system_terms_single_active_per_property;
CREATE UNIQUE INDEX idx_system_terms_single_active_per_property
ON public.system_terms(property_id)
WHERE is_active = true AND property_id IS NOT NULL;

-- Add comment for the table
COMMENT ON TABLE public.system_terms IS 'Terms and conditions - can be system-wide (property_id IS NULL) or property-specific (property_id = specific property)';