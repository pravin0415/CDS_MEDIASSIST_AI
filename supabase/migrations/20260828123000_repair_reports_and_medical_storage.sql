-- Additive repair migration for existing projects and first-time deployments.

alter table if exists public.ai_reports
  add column if not exists model text,
  add column if not exists report jsonb;

insert into storage.buckets (id, name, public)
values ('medical-files', 'medical-files', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Patients upload own medical files" on storage.objects;
create policy "Patients upload own medical files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'medical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Patients read own medical files and doctors read all" on storage.objects;
create policy "Patients read own medical files and doctors read all"
on storage.objects for select to authenticated
using (
  bucket_id = 'medical-files'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'doctor'
    )
  )
);

drop policy if exists "Patients update own medical files" on storage.objects;
create policy "Patients update own medical files"
on storage.objects for update to authenticated
using (
  bucket_id = 'medical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'medical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Patients delete own medical files" on storage.objects;
create policy "Patients delete own medical files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'medical-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
