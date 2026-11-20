-- Restrict Markdown note access to authenticated users and index the notebook ownership key.

begin;

revoke all privileges on table public.markdown_notes from anon, authenticated;
grant select, insert, update, delete on table public.markdown_notes to authenticated;

drop index if exists public.markdown_notes_notebook_updated_idx;
drop index if exists public.markdown_notes_user_notebook_idx;

create index markdown_notes_notebook_user_updated_idx
  on public.markdown_notes(notebook_id, user_id, updated_at desc);

commit;
