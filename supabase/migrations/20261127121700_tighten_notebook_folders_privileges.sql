begin;

revoke all privileges on table public.notebook_folders from anon, authenticated;

grant select, insert, update, delete
  on table public.notebook_folders to authenticated;

commit;
