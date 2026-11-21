-- Picture diary entries and private artwork storage for CHECKPOINT.
-- Each row belongs to one authenticated user and one diary notebook.

begin;

create table public.picture_diary_entries (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  title text not null default '',
  weather text not null default 'sunny',
  wake_time text not null default '',
  sleep_time text not null default '',
  drawing_path text,
  drawing_state jsonb,
  journal_content text not null default '',
  memo text not null default '',
  reflection text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint picture_diary_entries_notebook_owner_fkey
    foreign key (notebook_id, user_id)
    references public.notebooks(id, user_id)
    on delete cascade,
  constraint picture_diary_entries_notebook_date_key
    unique (notebook_id, entry_date)
);

create index picture_diary_entries_user_notebook_date_idx
  on public.picture_diary_entries(user_id, notebook_id, entry_date desc);

alter table public.picture_diary_entries enable row level security;

grant select, insert, update, delete
  on table public.picture_diary_entries to authenticated;

create policy "picture_diary_entries_select_own"
  on public.picture_diary_entries
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = picture_diary_entries.notebook_id
        and n.user_id = picture_diary_entries.user_id
        and n.notebook_type = 'diary'
    )
  );

create policy "picture_diary_entries_insert_own"
  on public.picture_diary_entries
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = picture_diary_entries.notebook_id
        and n.user_id = picture_diary_entries.user_id
        and n.notebook_type = 'diary'
    )
  );

create policy "picture_diary_entries_update_own"
  on public.picture_diary_entries
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = picture_diary_entries.notebook_id
        and n.user_id = picture_diary_entries.user_id
        and n.notebook_type = 'diary'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = picture_diary_entries.notebook_id
        and n.user_id = picture_diary_entries.user_id
        and n.notebook_type = 'diary'
    )
  );

create policy "picture_diary_entries_delete_own"
  on public.picture_diary_entries
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = picture_diary_entries.notebook_id
        and n.user_id = picture_diary_entries.user_id
        and n.notebook_type = 'diary'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'picture-diary-assets',
  'picture-diary-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "picture_diary_assets_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'picture-diary-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.notebooks n
      where n.id::text = (storage.foldername(name))[2]
        and n.user_id = (select auth.uid())
        and n.notebook_type = 'diary'
    )
  );

create policy "picture_diary_assets_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'picture-diary-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.notebooks n
      where n.id::text = (storage.foldername(name))[2]
        and n.user_id = (select auth.uid())
        and n.notebook_type = 'diary'
    )
  );

create policy "picture_diary_assets_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'picture-diary-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.notebooks n
      where n.id::text = (storage.foldername(name))[2]
        and n.user_id = (select auth.uid())
        and n.notebook_type = 'diary'
    )
  );

commit;
