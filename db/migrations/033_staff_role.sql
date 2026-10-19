ALTER TABLE public.boarding_house_app_users
  DROP CONSTRAINT IF EXISTS boarding_house_app_users_role_check;

ALTER TABLE public.boarding_house_app_users
  ADD CONSTRAINT boarding_house_app_users_role_check CHECK (
    role IN ('Student', 'Landlord', 'ICT Admin', 'OSA/SAS Admin', 'Staff')
  );
