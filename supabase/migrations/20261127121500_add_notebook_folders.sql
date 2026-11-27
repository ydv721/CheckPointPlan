begin;

create table public.notebook_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notebook_folders_name_not_blank
    check (char_length(btrim(name)) between 1 and 40),
  constraint notebook_folders_id_user_id_key
    unique (id, user_id)
);

create unique index notebook_folders_user_name_unique
  on public.notebook_folders (user_id, lower(name));

alter table public.notebook_folders enable row level security;

grant select, insert, update, delete
  on table public.notebook_folders to authenticated;

create policy notebook_folders_select_own
  on public.notebook_folders
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy notebook_folders_insert_own
  on public.notebook_folders
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy notebook_folders_update_own
  on public.notebook_folders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy notebook_folders_delete_own
  on public.notebook_folders
  for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.notebooks
  add column folder_id uuid;

alter table public.notebooks
  add constraint notebooks_folder_owner_fkey
  foreign key (folder_id, user_id)
  references public.notebook_folders (id, user_id)
  on delete set null (folder_id);

create index notebooks_user_folder_idx
  on public.notebooks (user_id, folder_id);

commit;
