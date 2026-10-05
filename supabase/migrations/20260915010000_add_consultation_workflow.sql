-- Patient-authorised clinician escalation. Apply after prior migrations.

create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  submission_id uuid references public.medical_submissions(id) on delete set null,
  decision_tier text not null check (decision_tier in ('CRITICAL', 'HIGH_URGENCY')),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.clinician_followups (
  id uuid primary key default gen_random_uuid(),
  consultation_request_id uuid not null references public.consultation_requests(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  doctor_id uuid not null references auth.users(id) on delete cascade,
  consultation_mode text not null check (consultation_mode in ('in_person', 'video', 'phone')),
  follow_up_plan text not null check (char_length(trim(follow_up_plan)) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.consultation_requests enable row level security;
alter table public.clinician_followups enable row level security;

create policy "Patients create own urgent consultation requests"
on public.consultation_requests for insert to authenticated
with check (
  patient_id = auth.uid()
  and decision_tier in ('CRITICAL', 'HIGH_URGENCY')
  and exists (
    select 1 from public.medical_submissions s
    where s.id = submission_id
      and s.patient_id = auth.uid()
      and s.ai_result ->> 'decision_tier' = decision_tier
  )
);

create policy "Patients view own consultation requests"
on public.consultation_requests for select to authenticated
using (patient_id = auth.uid());

create policy "Doctors view requested consultations"
on public.consultation_requests for select to authenticated
using (public.get_user_role(auth.uid()) = 'doctor');

create policy "Patients view own clinician follow-ups"
on public.clinician_followups for select to authenticated
using (patient_id = auth.uid());

create policy "Doctors view follow-ups for authorised consultations"
on public.clinician_followups for select to authenticated
using (public.get_user_role(auth.uid()) = 'doctor');

create policy "Doctors create follow-ups for authorised consultations"
on public.clinician_followups for insert to authenticated
with check (
  doctor_id = auth.uid()
  and public.get_user_role(auth.uid()) = 'doctor'
  and exists (
    select 1 from public.consultation_requests r
    where r.id = consultation_request_id
      and r.patient_id = patient_id
      and r.status in ('requested', 'accepted')
  )
);

-- Replace broad doctor read access with patient-authorised consultation access.
drop policy if exists "Users read own submissions or doctors read all" on public.medical_submissions;
create policy "Patients and authorised doctors read submissions"
on public.medical_submissions for select to authenticated
using (
  patient_id = auth.uid()
  or (
    public.get_user_role(auth.uid()) = 'doctor'
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = medical_submissions.patient_id
        and r.status in ('requested', 'accepted')
    )
  )
);

drop policy if exists "Users view own ai reports or doctors view all" on public.ai_reports;
create policy "Patients and authorised doctors view AI reports"
on public.ai_reports for select to authenticated
using (
  patient_id = auth.uid()
  or (
    public.get_user_role(auth.uid()) = 'doctor'
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = ai_reports.patient_id
        and r.status in ('requested', 'accepted')
    )
  )
);

drop policy if exists "Patients read own medical files and doctors read all" on storage.objects;
drop policy if exists "Authenticated users read medical files" on storage.objects;
create policy "Patients and authorised doctors read medical files"
on storage.objects for select to authenticated
using (
  bucket_id = 'medical-files'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or (
      public.get_user_role(auth.uid()) = 'doctor'
      and exists (
        select 1 from public.consultation_requests r
        where r.patient_id::text = (storage.foldername(name))[1]
          and r.status in ('requested', 'accepted')
      )
    )
  )
);

-- The doctor lookup now requires the patient's consultation request. This
-- prevents a doctor ID search from being used to browse unrelated records.
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
    and upper(p.user_code) = upper(trim(search_patient_code))
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = p.id and r.status in ('requested', 'accepted')
    );
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
    and exists (
      select 1 from public.consultation_requests r
      where r.patient_id = target_patient_id
        and r.status in ('requested', 'accepted')
    )
  order by s.created_at desc;
$$;

grant execute on function public.doctor_find_patient(text) to authenticated;
grant execute on function public.doctor_get_patient_submissions(uuid) to authenticated;
