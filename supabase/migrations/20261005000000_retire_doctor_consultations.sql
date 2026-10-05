-- Retire the patient-doctor connection without deleting accounts or history.
-- Apply after all earlier project migrations. This migration also closes older
-- broad doctor policies that may remain from schema.sql / early migrations.
begin;

-- Historical requests and follow-ups are retained for administrators, but
-- neither patients nor doctor-role accounts can use these tables via the API.
drop policy if exists "Patients create own urgent consultation requests" on public.consultation_requests;
drop policy if exists "Patients view own consultation requests" on public.consultation_requests;
drop policy if exists "Doctors view requested consultations" on public.consultation_requests;
drop policy if exists "Patients request verified selected doctor" on public.consultation_requests;
drop policy if exists "Patients request selected doctor" on public.consultation_requests;
drop policy if exists "Selected verified doctor views consultations" on public.consultation_requests;
drop policy if exists "Selected doctor views consultations" on public.consultation_requests;
revoke all on public.consultation_requests from anon, authenticated;

drop policy if exists "Patients view own clinician follow-ups" on public.clinician_followups;
drop policy if exists "Doctors view follow-ups for authorised consultations" on public.clinician_followups;
drop policy if exists "Doctors create follow-ups for authorised consultations" on public.clinician_followups;
drop policy if exists "Authoring doctor views follow-ups" on public.clinician_followups;
drop policy if exists "Selected verified doctor creates follow-ups" on public.clinician_followups;
drop policy if exists "Selected doctor views follow-ups" on public.clinician_followups;
drop policy if exists "Selected doctor creates follow-ups" on public.clinician_followups;
revoke all on public.clinician_followups from anon, authenticated;

-- Only patients can create profiles through the client. Existing doctor-role
-- profiles remain but can read only their own profile and cannot enter the
-- retired portal or create new patient links.
drop policy if exists "Users can read own profile or doctors read all" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Doctors can view all profiles" on public.profiles;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated
using (id = auth.uid());
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Patients insert own profile" on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'patient');
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Remove every known broad doctor read policy, then keep owner-only access.
drop policy if exists "Patients read own submissions" on public.medical_submissions;
drop policy if exists "Doctors read all submissions" on public.medical_submissions;
drop policy if exists "Users read own submissions or doctors read all" on public.medical_submissions;
drop policy if exists "Patients and authorised doctors read submissions" on public.medical_submissions;
drop policy if exists "Patients and selected doctor read submissions" on public.medical_submissions;
create policy "Patients read own submissions" on public.medical_submissions
for select to authenticated using (patient_id = auth.uid() and public.get_user_role(auth.uid()) = 'patient');
drop policy if exists "Patients insert own submissions" on public.medical_submissions;
create policy "Patients insert own submissions" on public.medical_submissions
for insert to authenticated with check (patient_id = auth.uid() and public.get_user_role(auth.uid()) = 'patient');

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
create policy "Patients view own ai reports" on public.ai_reports
for select to authenticated using (patient_id = auth.uid() and public.get_user_role(auth.uid()) = 'patient');

-- Keep the medical bucket private; reads and uploads are patient-folder only.
update storage.buckets set public = false where id = 'medical-files';
drop policy if exists "Authenticated users read medical files" on storage.objects;
drop policy if exists "Patients read own medical files and doctors read all" on storage.objects;
drop policy if exists "Patients and authorised doctors read medical files" on storage.objects;
drop policy if exists "Patients and selected doctor read medical files" on storage.objects;
create policy "Patients read own medical files" on storage.objects
for select to authenticated using (
  bucket_id = 'medical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.get_user_role(auth.uid()) = 'patient'
);
drop policy if exists "Authenticated users upload medical files" on storage.objects;
drop policy if exists "Patients upload own medical files" on storage.objects;
create policy "Patients upload own medical files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'medical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.get_user_role(auth.uid()) = 'patient'
);
drop policy if exists "Patients update own medical files" on storage.objects;
create policy "Patients update own medical files" on storage.objects
for update to authenticated
using (bucket_id = 'medical-files' and (storage.foldername(name))[1] = auth.uid()::text and public.get_user_role(auth.uid()) = 'patient')
with check (bucket_id = 'medical-files' and (storage.foldername(name))[1] = auth.uid()::text and public.get_user_role(auth.uid()) = 'patient');
drop policy if exists "Patients delete own medical files" on storage.objects;
create policy "Patients delete own medical files" on storage.objects
for delete to authenticated
using (bucket_id = 'medical-files' and (storage.foldername(name))[1] = auth.uid()::text and public.get_user_role(auth.uid()) = 'patient');

-- These SECURITY DEFINER RPCs could bypass row-level security. Remove them
-- after the policies above have released all function dependencies.
drop function if exists public.set_consultation_status(uuid, text);
drop function if exists public.doctor_find_patient(text);
drop function if exists public.doctor_get_patient_submissions(uuid);
drop function if exists public.find_doctor_by_code(text);
drop function if exists public.find_verified_doctor(text);
drop function if exists public.is_doctor_account(uuid);
drop function if exists public.is_verified_doctor(uuid);

commit;
