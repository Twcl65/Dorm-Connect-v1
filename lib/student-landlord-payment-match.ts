/** CTE: landlord payment ids belonging to the student ($1 = student_user_id). */
export const MATCHED_STUDENT_LANDLORD_PAYMENTS_CTE = `
matched_student_landlord_payments AS (
  SELECT lp.id
  FROM public.landlord_payments lp
  INNER JOIN public.boarding_house_app_users stu ON stu.id = $1::uuid
  LEFT JOIN public.landlord_tenant_leases ltl ON ltl.id = lp.tenant_lease_id
  LEFT JOIN public.student_dorm_reservations s_lease
    ON s_lease.id = ltl.student_reservation_id
    AND s_lease.student_user_id = $1::uuid
    AND s_lease.status <> 'Cancelled'
  WHERE s_lease.id IS NOT NULL
     OR (
       lp.room_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.student_dorm_reservations sr
         WHERE sr.student_user_id = $1::uuid
           AND sr.status <> 'Cancelled'
           AND sr.room_id = lp.room_id
           AND (
             lower(trim(lp.payer_name)) = lower(trim(stu.full_name))
             OR lower(trim(lp.payer_name)) = lower(trim(sr.guest_name))
           )
       )
     )
)`;
