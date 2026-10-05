-- Restore doctor workflow without a DOC code. Apply after earlier migrations.
-- A Patient ID starts a request; it NEVER grants access by itself.
-- The patient approves a specific doctor-role account in their portal.
-- Doctor-role registration is self-declared in this academic prototype; it is
-- not medical licence verification or a deployable e-prescription system.
begin;

alter table public.consultation_requests
  drop constraint if exists consultation_requests_decision_tier_check;
alter table public.consultation_requests
  add constraint consultation_requests_decision_tier_check
  check (decision_tier in ('CRITICAL', 'HIGH_URGENCY', 'MODERATE', 'UNCERTAIN'));
alter table public.consultation_requests
  add column if not exists doctor_id uuid references auth.users(id) on delete set null;
alter table public.clinician_followups
  add column if not exists note_type text not null default 'follow_up';
alter table public.clinician_followups
  drop constraint if exists clinician_followups_note_type_check;
alter table public.clinician_followups
  add constraint clinician_followups_note_type_check
  check (note_type in ('follow_up', 'checkup', 'report'));

-- Existing profiles remain. New doctor-role accounts are possible, but are
-- not automatically trusted: the patient must approve each connection.
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Patients insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert to authenticated
with check (id = auth.uid() and role in ('patient', 'doctor'));
drop policy if exists "Users can read own profile or doctors read all" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Doctors can view all profiles" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated
using (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

drop policy if exists "Patients create own urgent consultation requests" on public.consultation_requests;
drop policy if exists "Patients request verified selected doctor" on public.consultation_requests;
drop policy if exists "Patients request selected doctor" on public.consultation_requests;
drop policy if exists "Patients view own consultation requests" on public.consultation_requests;
drop policy if exists "Doctors view requested consultations" on public.consultation_requests;
drop policy if exists "Selected verified doctor views consultations" on public.consultation_requests;
drop policy if exists "Selected doctor views consultations" on public.consultation_requests;
create policy "Patients view own consultation requests" on public.consultation_requests
for select to authenticated using (patient_id = auth.uid());
create policy "Doctor views own connection requests" on public.consultation_requests
for select to authenticated using (
  doctor_id = auth.uid() and public.get_user_role(auth.uid()) = 'doctor'
);
grant select on public.consultation_requests to authenticated;

create or replace function public.request_patient_connection(search_patient_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  target_patient_id uuid;
  target_submission_id uuid;
  target_tier text;
  new_request_id uuid;
begin
  if auth.uid() is null or public.get_user_role(auth.uid()) <> 'doctor' then
    raise exception 'Doctor account required';
  end if;
  if length(trim(search_patient_code)) not between 5 and 45 then
    raise exception 'Invalid Patient ID';
  end if;
  select p.id into target_patient_id from public.profiles p
  where p.role = 'patient' and upper(p.user_code) = upper(trim(search_patient_code))
  limit 1;
  if target_patient_id is null then raise exception 'Patient ID not found'; end if;

  select s.id, s.ai_result ->> 'decision_tier'
    into target_submission_id, target_tier
  from public.medical_submissions s
  where s.patient_id = target_patient_id
    and s.ai_result ->> 'decision_tier' in ('CRITICAL', 'HIGH_URGENCY', 'MODERATE', 'UNCERTAIN')
  order by s.created_at desc limit 1;
  if target_submission_id is null then
    raise exception 'No eligible AI screening result for this Patient ID';
  end if;
  if exists (
    select 1 from public.consultation_requests r
    where r.patient_id = target_patient_id and r.doctor_id = auth.uid()
      and r.status in ('requested', 'accepted')
  ) then
    raise exception 'A request for this patient is already pending or active';
  end if;

  insert into public.consultation_requests
    (patient_id, doctor_id, submission_id, decision_tier, status)
  values (target_patient_id, auth.uid(), target_submission_id, target_tier, 'requested')
  returning id into new_request_id;
  return new_request_id;
end;
$$;
revoke all on function public.request_patient_connection(text) from public, anon;
grant execute on function public.request_patient_connection(text) to authenticated;

create or replace function public.list_patient_consultations()
returns table (id uuid, doctor_name text, decision_tier text, status text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select r.id, p.full_name, r.decision_tier, r.status, r.created_at
  from public.consultation_requests r
  join public.profiles p on p.id = r.doctor_id and p.role = 'doctor'
  where r.patient_id = auth.uid()
    and public.get_user_role(auth.uid()) = 'patient'
  order by r.created_at desc;
$$;
revoke all on function public.list_patient_consultations() from public, anon;
grant execute on function public.list_patient_consultations() to authenticated;

create or replace function public.set_consultation_status(request_id uuid, next_status text)
returns void language plpgsql security definer set search_path = public
as $$
declare current_request public.consultation_requests%rowtype;
begin
  select * into current_request from public.consultation_requests where id = request_id for update;
  if not found then raise exception 'Consultation request not found'; end if;
  if current_request.patient_id = auth.uid()
      and next_status = 'accepted' and current_request.status = 'requested' then
    update public.consultation_requests set status = 'accepted' where id = request_id;
  elsif current_request.patient_id = auth.uid()
      and next_status = 'cancelled' and current_request.status in ('requested', 'accepted') then
    update public.consultation_requests set status = 'cancelled' where id = request_id;
  elsif current_request.doctor_id = auth.uid()
      and public.get_user_role(auth.uid()) = 'doctor'
      and next_status = 'completed' and current_request.status = 'accepted' then
    update public.consultation_requests set status = 'completed' where id = request_id;
  else
    raise exception 'Status transition not permitted';
  end if;
end;
$$;
revoke all on function public.set_consultation_status(uuid, text) from public, anon;
grant execute on function public.set_consultation_status(uuid, text) to authenticated;

create or replace function public.doctor_find_patient(search_patient_code text)
returns table (id uuid, full_name text, user_code text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.user_code from public.profiles p
  where public.get_user_role(auth.uid()) = 'doctor'
    and p.role = 'patient'
    and upper(p.user_code) = upper(trim(search_patient_code))
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = p.id and r.doctor_id = auth.uid() and r.status = 'accepted'
    )
  limit 1;
$$;
create or replace function public.doctor_get_patient_submissions(target_patient_id uuid)
returns setof public.medical_submissions
language sql stable security definer set search_path = public
as $$
  select s.* from public.medical_submissions s
  where public.get_user_role(auth.uid()) = 'doctor'
    and s.patient_id = target_patient_id
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = target_patient_id and r.doctor_id = auth.uid()
        and r.status = 'accepted'
    )
  order by s.created_at desc;
$$;
revoke all on function public.doctor_find_patient(text) from public, anon;
revoke all on function public.doctor_get_patient_submissions(uuid) from public, anon;
grant execute on function public.doctor_find_patient(text) to authenticated;
grant execute on function public.doctor_get_patient_submissions(uuid) to authenticated;

drop policy if exists "Patients read own submissions" on public.medical_submissions;
drop policy if exists "Doctors read all submissions" on public.medical_submissions;
drop policy if exists "Users read own submissions or doctors read all" on public.medical_submissions;
drop policy if exists "Patients and authorised doctors read submissions" on public.medical_submissions;
drop policy if exists "Patients and selected doctor read submissions" on public.medical_submissions;
create policy "Patients and approved doctor read submissions" on public.medical_submissions
for select to authenticated using (
  patient_id = auth.uid() or (
    public.get_user_role(auth.uid()) = 'doctor' and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = medical_submissions.patient_id
        and r.doctor_id = auth.uid() and r.status = 'accepted'
    )
  )
);
drop policy if exists "Patients insert own submissions" on public.medical_submissions;
create policy "Patients insert own submissions" on public.medical_submissions
for insert to authenticated with check (
  patient_id = auth.uid() and public.get_user_role(auth.uid()) = 'patient'
);
grant select, insert on public.medical_submissions to authenticated;

drop policy if exists "Patients can view own ai reports" on public.ai_reports;
drop policy if exists "Doctors can view patient ai reports" on public.ai_reports;
drop policy if exists "Doctors can create ai reports" on public.ai_reports;
drop policy if exists "Patients view own ai reports" on public.ai_reports;
drop policy if exists "Doctors view all ai reports" on public.ai_reports;
drop policy if exists "Users view own ai reports or doctors view all" on public.ai_reports;
drop policy if exists "Patients and authorised doctors view AI reports" on public.ai_reports;
drop policy if exists "Patients and selected doctor view AI reports" on public.ai_reports;
drop policy if exists "Doctors create ai reports" on public.ai_reports;
drop policy if exists "Selected doctor creates AI reports" on public.ai_reports;
create policy "Patients and approved doctor view AI reports" on public.ai_reports
for select to authenticated using (
  patient_id = auth.uid() or (
    public.get_user_role(auth.uid()) = 'doctor' and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = ai_reports.patient_id
        and r.doctor_id = auth.uid() and r.status = 'accepted'
    )
  )
);
create policy "Approved doctor creates AI reports" on public.ai_reports
for insert to authenticated with check (
  doctor_id = auth.uid() and public.get_user_role(auth.uid()) = 'doctor'
  and exists (
    select 1 from public.consultation_requests r
    where r.patient_id = ai_reports.patient_id
      and r.doctor_id = auth.uid() and r.status = 'accepted'
  )
);
grant select, insert on public.ai_reports to authenticated;

drop policy if exists "Patients view own clinician follow-ups" on public.clinician_followups;
drop policy if exists "Doctors view follow-ups for authorised consultations" on public.clinician_followups;
drop policy if exists "Doctors create follow-ups for authorised consultations" on public.clinician_followups;
drop policy if exists "Authoring doctor views follow-ups" on public.clinician_followups;
drop policy if exists "Selected verified doctor creates follow-ups" on public.clinician_followups;
drop policy if exists "Selected doctor views follow-ups" on public.clinician_followups;
drop policy if exists "Selected doctor creates follow-ups" on public.clinician_followups;
create policy "Patients view own clinician follow-ups" on public.clinician_followups
for select to authenticated using (patient_id = auth.uid());
create policy "Approved doctor views own follow-ups" on public.clinician_followups
for select to authenticated using (
  doctor_id = auth.uid() and public.get_user_role(auth.uid()) = 'doctor'
);
create policy "Approved doctor creates follow-ups" on public.clinician_followups
for insert to authenticated with check (
  doctor_id = auth.uid() and public.get_user_role(auth.uid()) = 'doctor'
  and exists (
    select 1 from public.consultation_requests r
    where r.id = consultation_request_id and r.patient_id = clinician_followups.patient_id
      and r.doctor_id = auth.uid() and r.status = 'accepted'
  )
);
grant select, insert on public.clinician_followups to authenticated;

update storage.buckets set public = false where id = 'medical-files';
drop policy if exists "Authenticated users read medical files" on storage.objects;
drop policy if exists "Patients read own medical files and doctors read all" on storage.objects;
drop policy if exists "Patients and authorised doctors read medical files" on storage.objects;
drop policy if exists "Patients and selected doctor read medical files" on storage.objects;
drop policy if exists "Patients read own medical files" on storage.objects;
create policy "Patients and approved doctor read medical files" on storage.objects
for select to authenticated using (
  bucket_id = 'medical-files' and (
    (storage.foldername(name))[1] = auth.uid()::text or (
      public.get_user_role(auth.uid()) = 'doctor' and exists (
        select 1 from public.consultation_requests r
        where r.patient_id::text = (storage.foldername(name))[1]
          and r.doctor_id = auth.uid() and r.status = 'accepted'
      )
    )
  )
);
drop policy if exists "Authenticated users upload medical files" on storage.objects;
drop policy if exists "Patients upload own medical files" on storage.objects;
create policy "Patients upload own medical files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'medical-files' and (storage.foldername(name))[1] = auth.uid()::text
    and public.get_user_role(auth.uid()) = 'patient'
);

-- DOC-code RPCs stay removed. Old verification records are retained only as
-- historical database data; no new code or approval is needed.
drop function if exists public.find_doctor_by_code(text);
drop function if exists public.find_verified_doctor(text);
drop function if exists public.is_doctor_account(uuid);
drop function if exists public.is_verified_doctor(uuid);
notify pgrst, 'reload schema';
commit;
