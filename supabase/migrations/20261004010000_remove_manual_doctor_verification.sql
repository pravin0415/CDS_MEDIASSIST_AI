-- Apply after 20261004000000_verified_doctor_consent.sql.
-- Doctor-role accounts no longer require an administrator approval entry.
-- A DOC code identifies an account, NOT a medical licence or qualification.
-- Keep patient-selected, active consultation consent as the access boundary.
begin;

create or replace function public.is_doctor_account(target_doctor_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select target_doctor_id is not null
    and public.get_user_role(target_doctor_id) = 'doctor';
$$;
grant execute on function public.is_doctor_account(uuid) to authenticated;

update public.profiles
set user_code = 'DOC-' || upper(replace(id::text, '-', ''))
where role = 'doctor' and (user_code is null or trim(user_code) = '');

create or replace function public.find_doctor_by_code(search_doctor_code text)
returns table (id uuid, full_name text, user_code text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.user_code
  from public.profiles p
  where auth.uid() is not null
    and public.get_user_role(auth.uid()) = 'patient'
    and length(trim(search_doctor_code)) between 5 and 45
    and upper(p.user_code) = upper(trim(search_doctor_code))
    and public.is_doctor_account(p.id)
  limit 1;
$$;
grant execute on function public.find_doctor_by_code(text) to authenticated;

drop policy if exists "Patients request verified selected doctor" on public.consultation_requests;
drop policy if exists "Patients request selected doctor" on public.consultation_requests;
create policy "Patients request selected doctor"
on public.consultation_requests for insert to authenticated
with check (
  patient_id = auth.uid()
  and public.get_user_role(auth.uid()) = 'patient'
  and public.is_doctor_account(doctor_id)
  and decision_tier in ('CRITICAL', 'HIGH_URGENCY')
  and status = 'requested'
  and exists (
    select 1 from public.medical_submissions s
    where s.id = submission_id and s.patient_id = auth.uid()
      and s.ai_result ->> 'decision_tier' = decision_tier
  )
);
drop policy if exists "Selected verified doctor views consultations" on public.consultation_requests;
drop policy if exists "Selected doctor views consultations" on public.consultation_requests;
create policy "Selected doctor views consultations"
on public.consultation_requests for select to authenticated
using (doctor_id = auth.uid() and public.is_doctor_account(auth.uid()));

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
  elsif current_request.doctor_id = auth.uid() and public.is_doctor_account(auth.uid())
      and ((next_status = 'accepted' and current_request.status = 'requested')
        or (next_status = 'completed' and current_request.status = 'accepted')) then
    update public.consultation_requests set status = next_status where id = request_id;
  else
    raise exception 'Status transition not permitted';
  end if;
end;
$$;

drop policy if exists "Authoring doctor views follow-ups" on public.clinician_followups;
drop policy if exists "Selected doctor views follow-ups" on public.clinician_followups;
create policy "Selected doctor views follow-ups"
on public.clinician_followups for select to authenticated
using (doctor_id = auth.uid() and public.is_doctor_account(auth.uid()));
drop policy if exists "Selected verified doctor creates follow-ups" on public.clinician_followups;
drop policy if exists "Selected doctor creates follow-ups" on public.clinician_followups;
create policy "Selected doctor creates follow-ups"
on public.clinician_followups for insert to authenticated
with check (
  doctor_id = auth.uid() and public.is_doctor_account(auth.uid())
  and exists (
    select 1 from public.consultation_requests r
    where r.id = consultation_request_id and r.patient_id = patient_id
      and r.doctor_id = auth.uid() and r.status = 'accepted'
  )
);

drop policy if exists "Patients and selected doctor read submissions" on public.medical_submissions;
create policy "Patients and selected doctor read submissions"
on public.medical_submissions for select to authenticated
using (
  patient_id = auth.uid() or (
    public.is_doctor_account(auth.uid()) and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = medical_submissions.patient_id
        and r.doctor_id = auth.uid() and r.status in ('requested', 'accepted')
    )
  )
);
drop policy if exists "Patients and selected doctor view AI reports" on public.ai_reports;
create policy "Patients and selected doctor view AI reports"
on public.ai_reports for select to authenticated
using (
  patient_id = auth.uid() or (
    public.is_doctor_account(auth.uid()) and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = ai_reports.patient_id
        and r.doctor_id = auth.uid() and r.status in ('requested', 'accepted')
    )
  )
);
drop policy if exists "Selected doctor creates AI reports" on public.ai_reports;
create policy "Selected doctor creates AI reports"
on public.ai_reports for insert to authenticated
with check (
  doctor_id = auth.uid() and public.is_doctor_account(auth.uid())
  and exists (
    select 1 from public.consultation_requests r
    where r.patient_id = ai_reports.patient_id
      and r.doctor_id = auth.uid() and r.status in ('requested', 'accepted')
  )
);

update storage.buckets set public = false where id = 'medical-files';
drop policy if exists "Patients and selected doctor read medical files" on storage.objects;
create policy "Patients and selected doctor read medical files"
on storage.objects for select to authenticated
using (
  bucket_id = 'medical-files' and (
    (storage.foldername(name))[1] = auth.uid()::text or (
      public.is_doctor_account(auth.uid()) and exists (
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
  where public.is_doctor_account(auth.uid()) and p.role = 'patient'
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
  where public.is_doctor_account(auth.uid()) and s.patient_id = target_patient_id
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = target_patient_id and r.doctor_id = auth.uid()
        and r.status in ('requested', 'accepted')
    )
  order by s.created_at desc;
$$;

-- The old approval table is retained to avoid deleting administrator data.
drop function if exists public.find_verified_doctor(text);
drop function if exists public.is_verified_doctor(uuid);
commit;
