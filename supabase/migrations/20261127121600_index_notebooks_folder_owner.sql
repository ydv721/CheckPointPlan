begin;

drop index if exists public.notebooks_user_folder_idx;

create index notebooks_folder_owner_idx
  on public.notebooks (folder_id, user_id);

commit;
