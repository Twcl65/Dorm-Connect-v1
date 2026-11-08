ALTER TABLE public.landlord_accreditation_requests
  DROP CONSTRAINT IF EXISTS landlord_accreditation_requests_status_check;

ALTER TABLE public.landlord_accreditation_requests
  ADD CONSTRAINT landlord_accreditation_requests_status_check CHECK (
    status IN (
      'Pending',
      'Renewing',
      'Scheduled for Inspection',
      'Recommended for Approval',
      'Hold',
      'Rejected',
      'Approved',
      'Expired'
    )
  );
