-- Completes the data contract used by the React patient and doctor portals.
-- Safe to apply to existing installations after the earlier schema/migrations.

alter table public.medical_submissions
  add column if not exists file_path text;

create or replace function public.doctor_find_patient(search_patient_code text)
returns table (id uuid, full_name text, user_code text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.user_code
  from public.profiles p
  where public.get_user_role(auth.uid()) = 'doctor'
    and p.role = 'patient'
    and upper(p.user_code) = upper(trim(search_patient_code));
$$;

create or replace function public.doctor_get_patient_submissions(target_patient_id uuid)
returns setof public.medical_submissions
language sql
security definer
set search_path = public
as $$
  select s.*
  from public.medical_submissions s
  where public.get_user_role(auth.uid()) = 'doctor'
    and s.patient_id = target_patient_id
  order by s.created_at desc;
$$;

grant execute on function public.doctor_find_patient(text) to authenticated;
grant execute on function public.doctor_get_patient_submissions(uuid) to authenticated;
