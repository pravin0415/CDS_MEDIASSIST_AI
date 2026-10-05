-- =========================================================
-- MEDIASSIST AI — COMPLETE SUPABASE DATABASE SETUP SCRIPT
-- Copy and run this script in your Supabase SQL Editor.
-- =========================================================

-- 1. PROFILES TABLE & COLUMNS
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('patient', 'doctor')),
  user_code text,
  specialty text,
  created_at timestamptz not null default now()
);

-- Ensure user_code column exists
alter table public.profiles add column if not exists user_code text;

alter table public.profiles enable row level security;

-- SECURITY DEFINER FUNCTION TO PREVENT RLS INFINITE RECURSION
create or replace function public.get_user_role(user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = user_id limit 1;
$$;

-- PROFILES RLS POLICIES (RECURSION-FREE)
drop policy if exists "Users can read own profile or doctors read all" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Doctors can view all profiles" on public.profiles;

create policy "Users can read own profile or doctors read all"
  on public.profiles for select to authenticated
  using (
    id = auth.uid() or public.get_user_role(auth.uid()) = 'doctor'
  );

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- 2. MEDICAL SUBMISSIONS TABLE
create table if not exists public.medical_submissions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  submission_type text not null,
  description text,
  selected_symptoms text[],
  file_path text,
  file_url text,
  file_name text,
  ai_result jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.medical_submissions enable row level security;

drop policy if exists "Patients read own submissions" on public.medical_submissions;
drop policy if exists "Doctors read all submissions" on public.medical_submissions;

create policy "Users read own submissions or doctors read all"
  on public.medical_submissions for select to authenticated
  using (
    patient_id = auth.uid() or public.get_user_role(auth.uid()) = 'doctor'
  );

drop policy if exists "Patients insert own submissions" on public.medical_submissions;
create policy "Patients insert own submissions"
  on public.medical_submissions for insert to authenticated
  with check (patient_id = auth.uid());

-- Doctor lookup functions used by DoctorDashboard. Both functions check the
-- caller's role internally, so a patient cannot enumerate other patients.
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

-- 3. AI REPORTS TABLE
create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users(id) on delete cascade,
  doctor_id uuid references auth.users(id) on delete set null,
  submission_id uuid references public.medical_submissions(id) on delete cascade,
  submission_type text not null,
  prediction text not null,
  confidence numeric,
  model text,
  report jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_reports enable row level security;

drop policy if exists "Patients view own ai reports" on public.ai_reports;
drop policy if exists "Doctors view all ai reports" on public.ai_reports;

create policy "Users view own ai reports or doctors view all"
  on public.ai_reports for select to authenticated
  using (
    patient_id = auth.uid() or public.get_user_role(auth.uid()) = 'doctor'
  );

drop policy if exists "Doctors create ai reports" on public.ai_reports;
create policy "Doctors create ai reports"
  on public.ai_reports for insert to authenticated
  with check (
    doctor_id = auth.uid() and public.get_user_role(auth.uid()) = 'doctor'
  );

-- 4. STORAGE BUCKET setup for medical file uploads
insert into storage.buckets (id, name, public)
values ('medical-files', 'medical-files', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated users upload medical files" on storage.objects;
create policy "Authenticated users upload medical files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'medical-files');

drop policy if exists "Authenticated users read medical files" on storage.objects;
create policy "Authenticated users read medical files"
  on storage.objects for select to authenticated
  using (bucket_id = 'medical-files');

-- 5. AUTO-CONFIRM ALL EXISTING USER EMAILS
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;
