-- Fix system_terms indexes to properly enforce one-active-term-per-property

-- Drop old incorrect indexes (were on PK id, not property_id)
DROP INDEX IF EXISTS public.idx_system_terms_single_active_systemwide;
DROP INDEX IF EXISTS public.idx_system_terms_single_active_per_property;

-- Deactivate all but the most recent active system-wide terms
-- (so the unique index can be created)
UPDATE public.system_terms
SET is_active = false
WHERE is_active = true
  AND property_id IS NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT id FROM public.system_terms
      WHERE is_active = true AND property_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    ) AS keep
  );

-- Deactivate all but the most recent active property-specific terms per property
UPDATE public.system_terms
SET is_active = false
WHERE is_active = true
  AND property_id IS NOT NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY property_id ORDER BY created_at DESC) AS rn
      FROM public.system_terms
      WHERE is_active = true AND property_id IS NOT NULL
    ) AS ranked
    WHERE ranked.rn = 1
  );

-- Create correct unique index for system-wide terms (one active)
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_terms_single_active_systemwide
ON public.system_terms((1))
WHERE is_active = true AND property_id IS NULL;

-- Create correct unique index for property-specific terms (one active per property)
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_terms_single_active_per_property
ON public.system_terms(property_id)
WHERE is_active = true AND property_id IS NOT NULL;
