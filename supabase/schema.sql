-- CHECKPOINT: review before applying to a NEW project. Applied in managed Supabase separately.
create table if not exists public.planner_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  dday text not null default '',
  date_label text not null default '',
  header_label text not null default '',
  header_value text not null default '',
  todos jsonb not null default '[]'::jsonb,
  memo text not null default '',
  timetable jsonb not null default '{}'::jsonb,
  focus text not null default '',
  keypoint text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, entry_date)
);
alter table public.planner_entries enable row level security;
create policy "entry_read" on public.planner_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "entry_insert" on public.planner_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "entry_update" on public.planner_entries for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "entry_delete" on public.planner_entries for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.planner_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'white',
  custom_color text not null default '#8b9ec4',
  cover jsonb not null default '{"title":"CHECKPOINT","subtitle":"YOUR PACE, YOUR CHECKPOINT.","items":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.planner_settings enable row level security;
create policy "settings_read" on public.planner_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings_insert" on public.planner_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings_update" on public.planner_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "settings_delete" on public.planner_settings for delete to authenticated using ((select auth.uid()) = user_id);

-- Storage should be private; per-user path prefix and RLS on storage.objects.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('checkpoint-covers','checkpoint-covers',false,5242880,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;
create policy "cover_read" on storage.objects for select to authenticated using (bucket_id='checkpoint-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cover_upload" on storage.objects for insert to authenticated with check (bucket_id='checkpoint-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cover_update" on storage.objects for update to authenticated using (bucket_id='checkpoint-covers' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id='checkpoint-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cover_delete" on storage.objects for delete to authenticated using (bucket_id='checkpoint-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
