ALTER TABLE public.landlord_payments
  DROP CONSTRAINT IF EXISTS landlord_payments_entry_source_check;

ALTER TABLE public.landlord_payments
  ADD CONSTRAINT landlord_payments_entry_source_check CHECK (
    entry_source IS NULL
    OR entry_source IN (
      'manual',
      'advance',
      'deposit',
      'deposit_release',
      'advance_withdrawal',
      'deposit_withdrawal'
    )
  );
