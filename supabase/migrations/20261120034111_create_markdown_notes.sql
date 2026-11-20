-- Markdown notes for free-notes diaries.
-- Applied to the managed CHECKPOINT Supabase project on 2026-11-20.

begin;

create table public.markdown_notes (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '제목 없는 글',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint markdown_notes_notebook_owner_fkey
    foreign key (notebook_id, user_id)
    references public.notebooks(id, user_id)
    on delete cascade
);

create index markdown_notes_notebook_updated_idx
  on public.markdown_notes(notebook_id, updated_at desc);

create index markdown_notes_user_notebook_idx
  on public.markdown_notes(user_id, notebook_id);

alter table public.markdown_notes enable row level security;

grant select, insert, update, delete
  on table public.markdown_notes to authenticated;

create policy "markdown_notes_select_own_free_diaries"
  on public.markdown_notes
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = markdown_notes.notebook_id
        and n.user_id = markdown_notes.user_id
        and n.notebook_type = 'free-notes'
    )
  );

create policy "markdown_notes_insert_own_free_diaries"
  on public.markdown_notes
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = markdown_notes.notebook_id
        and n.user_id = markdown_notes.user_id
        and n.notebook_type = 'free-notes'
    )
  );

create policy "markdown_notes_update_own_free_diaries"
  on public.markdown_notes
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = markdown_notes.notebook_id
        and n.user_id = markdown_notes.user_id
        and n.notebook_type = 'free-notes'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = markdown_notes.notebook_id
        and n.user_id = markdown_notes.user_id
        and n.notebook_type = 'free-notes'
    )
  );

create policy "markdown_notes_delete_own_free_diaries"
  on public.markdown_notes
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.notebooks n
      where n.id = markdown_notes.notebook_id
        and n.user_id = markdown_notes.user_id
        and n.notebook_type = 'free-notes'
    )
  );

commit;
