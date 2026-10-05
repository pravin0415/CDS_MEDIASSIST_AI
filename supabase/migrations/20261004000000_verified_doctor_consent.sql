-- Apply after 20260915010000_add_consultation_workflow.sql.
-- Doctor verification is an administrative action. Registration/license text alone
-- must never grant access to patient records.

create table if not exists public.verified_doctors (
  doctor_id uuid primary key references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now(),
  verified_by text not null,
  note text
);
alter table public.verified_doctors enable row level security;
revoke all on public.verified_doctors from anon, authenticated;

create or replace function public.is_verified_doctor(target_doctor_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select target_doctor_id is not null
    and exists (select 1 from public.verified_doctors v where v.doctor_id = target_doctor_id)
    and public.get_user_role(target_doctor_id) = 'doctor';
$$;
grant execute on function public.is_verified_doctor(uuid) to authenticated;

-- Existing doctor accounts get a lookup code, but are NOT verified automatically.
update public.profiles
set user_code = 'DOC-' || upper(replace(id::text, '-', ''))
where role = 'doctor' and (user_code is null or trim(user_code) = '');

-- A profile owner may edit their name, but not promote their role or change
-- the identity code used for patient consent.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
drop policy if exists "Users can read own profile or doctors read all" on public.profiles;
drop policy if exists "Doctors can view all profiles" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated
using (id = auth.uid());

create or replace function public.find_verified_doctor(search_doctor_code text)
returns table (id uuid, full_name text, user_code text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.user_code
  from public.profiles p
  where auth.uid() is not null
    and public.get_user_role(auth.uid()) = 'patient'
    and length(trim(search_doctor_code)) between 5 and 45
    and upper(p.user_code) = upper(trim(search_doctor_code))
    and public.is_verified_doctor(p.id)
  limit 1;
$$;
grant execute on function public.find_verified_doctor(text) to authenticated;

alter table public.consultation_requests
  add column if not exists doctor_id uuid references auth.users(id) on delete set null;
create index if not exists consultation_patient_doctor_status_idx
  on public.consultation_requests (patient_id, doctor_id, status);

drop policy if exists "Patients create own urgent consultation requests" on public.consultation_requests;
drop policy if exists "Patients request verified selected doctor" on public.consultation_requests;
create policy "Patients request verified selected doctor"
on public.consultation_requests for insert to authenticated
with check (
  patient_id = auth.uid()
  and public.get_user_role(auth.uid()) = 'patient'
  and public.is_verified_doctor(doctor_id)
  and decision_tier in ('CRITICAL', 'HIGH_URGENCY')
  and status = 'requested'
  and exists (
    select 1 from public.medical_submissions s
    where s.id = submission_id and s.patient_id = auth.uid()
      and s.ai_result ->> 'decision_tier' = decision_tier
  )
);
drop policy if exists "Doctors view requested consultations" on public.consultation_requests;
drop policy if exists "Selected verified doctor views consultations" on public.consultation_requests;
create policy "Selected verified doctor views consultations"
on public.consultation_requests for select to authenticated
using (doctor_id = auth.uid() and public.is_verified_doctor(auth.uid()));

create or replace function public.set_consultation_status(request_id uuid, next_status text)
returns void language plpgsql security definer set search_path = public
as $$
declare current_request public.consultation_requests%rowtype;
begin
  select * into current_request from public.consultation_requests where id = request_id for update;
  if not found then raise exception 'Consultation request not found'; end if;
  if next_status = 'cancelled' and current_request.patient_id = auth.uid()
      and current_request.status in ('requested', 'accepted') then
    update public.consultation_requests set status = 'cancelled' where id = request_id;
  elsif current_request.doctor_id = auth.uid() and public.is_verified_doctor(auth.uid())
      and ((next_status = 'accepted' and current_request.status = 'requested')
        or (next_status = 'completed' and current_request.status = 'accepted')) then
    update public.consultation_requests set status = next_status where id = request_id;
  else
    raise exception 'Status transition not permitted';
  end if;
end;
$$;
grant execute on function public.set_consultation_status(uuid, text) to authenticated;

drop policy if exists "Doctors view follow-ups for authorised consultations" on public.clinician_followups;
drop policy if exists "Authoring doctor views follow-ups" on public.clinician_followups;
create policy "Authoring doctor views follow-ups"
on public.clinician_followups for select to authenticated
using (doctor_id = auth.uid() and public.is_verified_doctor(auth.uid()));
drop policy if exists "Doctors create follow-ups for authorised consultations" on public.clinician_followups;
drop policy if exists "Selected verified doctor creates follow-ups" on public.clinician_followups;
create policy "Selected verified doctor creates follow-ups"
on public.clinician_followups for insert to authenticated
with check (
  doctor_id = auth.uid() and public.is_verified_doctor(auth.uid())
  and exists (
    select 1 from public.consultation_requests r
    where r.id = consultation_request_id and r.patient_id = patient_id
      and r.doctor_id = auth.uid() and r.status = 'accepted'
  )
);

drop policy if exists "Patients and authorised doctors read submissions" on public.medical_submissions;
drop policy if exists "Users read own submissions or doctors read all" on public.medical_submissions;
drop policy if exists "Doctors read all submissions" on public.medical_submissions;
drop policy if exists "Patients and selected doctor read submissions" on public.medical_submissions;
create policy "Patients and selected doctor read submissions"
on public.medical_submissions for select to authenticated
using (
  patient_id = auth.uid() or (
    public.is_verified_doctor(auth.uid()) and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = medical_submissions.patient_id
        and r.doctor_id = auth.uid() and r.status in ('requested', 'accepted')
    )
  )
);
drop policy if exists "Patients and authorised doctors view AI reports" on public.ai_reports;
drop policy if exists "Users view own ai reports or doctors view all" on public.ai_reports;
drop policy if exists "Doctors view all ai reports" on public.ai_reports;
drop policy if exists "Patients and selected doctor view AI reports" on public.ai_reports;
create policy "Patients and selected doctor view AI reports"
on public.ai_reports for select to authenticated
using (
  patient_id = auth.uid() or (
    public.is_verified_doctor(auth.uid()) and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = ai_reports.patient_id
        and r.doctor_id = auth.uid() and r.status in ('requested', 'accepted')
    )
  )
);
drop policy if exists "Doctors create ai reports" on public.ai_reports;
drop policy if exists "Selected doctor creates AI reports" on public.ai_reports;
create policy "Selected doctor creates AI reports"
on public.ai_reports for insert to authenticated
with check (
  doctor_id = auth.uid() and public.is_verified_doctor(auth.uid())
  and exists (
    select 1 from public.consultation_requests r
    where r.patient_id = ai_reports.patient_id
      and r.doctor_id = auth.uid() and r.status in ('requested', 'accepted')
  )
);

drop policy if exists "Patients and authorised doctors read medical files" on storage.objects;
update storage.buckets set public = false where id = 'medical-files';
drop policy if exists "Patients read own medical files and doctors read all" on storage.objects;
drop policy if exists "Authenticated users read medical files" on storage.objects;
drop policy if exists "Authenticated users upload medical files" on storage.objects;
drop policy if exists "Patients and selected doctor read medical files" on storage.objects;
create policy "Patients and selected doctor read medical files"
on storage.objects for select to authenticated
using (
  bucket_id = 'medical-files' and (
    (storage.foldername(name))[1] = auth.uid()::text or (
      public.is_verified_doctor(auth.uid()) and exists (
        select 1 from public.consultation_requests r
        where r.patient_id::text = (storage.foldername(name))[1]
          and r.doctor_id = auth.uid() and r.status in ('requested', 'accepted')
      )
    )
  )
);

create or replace function public.doctor_find_patient(search_patient_code text)
returns table (id uuid, full_name text, user_code text)
language sql security definer set search_path = public
as $$
  select p.id, p.full_name, p.user_code from public.profiles p
  where public.is_verified_doctor(auth.uid()) and p.role = 'patient'
    and upper(p.user_code) = upper(trim(search_patient_code))
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = p.id and r.doctor_id = auth.uid()
        and r.status in ('requested', 'accepted')
    );
$$;
create or replace function public.doctor_get_patient_submissions(target_patient_id uuid)
returns setof public.medical_submissions
language sql security definer set search_path = public
as $$
  select s.* from public.medical_submissions s
  where public.is_verified_doctor(auth.uid()) and s.patient_id = target_patient_id
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = target_patient_id and r.doctor_id = auth.uid()
        and r.status in ('requested', 'accepted')
    )
  order by s.created_at desc;
$$;
