ALTER TABLE public.landlord_properties
  DROP CONSTRAINT IF EXISTS landlord_properties_property_type_check;

ALTER TABLE public.landlord_properties
  ADD CONSTRAINT landlord_properties_property_type_check
  CHECK (
    property_type IN (
      'Dormitory',
      'Boarding House',
      'Apartment',
      'House for Rent',
      'House',
      'Pad',
      'Other'
    )
  );
