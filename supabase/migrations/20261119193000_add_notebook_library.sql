-- CHECKPOINT multi-notebook schema.
-- Applied to the managed CHECKPOINT Supabase project on 2026-11-19.
begin;

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_type text not null check (notebook_type in ('planner','study-notes','diary','checklist','free-notes')),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notebooks_id_user_id_key unique (id,user_id)
);
alter table public.notebooks enable row level security;
grant select,insert,update,delete on public.notebooks to authenticated;
create policy "notebooks_select_own" on public.notebooks for select to authenticated using ((select auth.uid())=user_id);
create policy "notebooks_insert_own" on public.notebooks for insert to authenticated with check ((select auth.uid())=user_id);
create policy "notebooks_update_own" on public.notebooks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "notebooks_delete_own" on public.notebooks for delete to authenticated using ((select auth.uid())=user_id);

insert into public.notebooks(user_id,notebook_type,title)
select u.id,'planner','내 플래너' from auth.users u;

alter table public.planner_entries add column notebook_id uuid;
update public.planner_entries pe set notebook_id=n.id
from public.notebooks n where n.user_id=pe.user_id and n.notebook_type='planner';
alter table public.planner_entries alter column notebook_id set not null;
alter table public.planner_entries drop constraint planner_entries_user_id_entry_date_key;
alter table public.planner_entries add constraint planner_entries_notebook_owner_fkey
foreign key(notebook_id,user_id) references public.notebooks(id,user_id) on delete cascade;
alter table public.planner_entries add constraint planner_entries_notebook_id_entry_date_key unique(notebook_id,entry_date);
create index notebooks_user_updated_idx on public.notebooks(user_id,updated_at desc);

alter table public.planner_settings add column notebook_id uuid;
update public.planner_settings ps set notebook_id=n.id
from public.notebooks n where n.user_id=ps.user_id and n.notebook_type='planner';
insert into public.planner_settings(user_id,notebook_id,theme,custom_color,cover)
select n.user_id,n.id,'blue','#8b9ec4',
'{"subtitle":"","subtitleConverted":true,"items":[],"colorLabels":["","","","",""],"backgroundPattern":"grid","patternThickness":2,"backgroundPositionX":50,"backgroundPositionY":50,"monthEntries":{},"monthMemos":{}}'::jsonb
from public.notebooks n left join public.planner_settings ps on ps.notebook_id=n.id
where n.notebook_type='planner' and ps.notebook_id is null;
alter table public.planner_settings alter column notebook_id set not null;
alter table public.planner_settings add column id uuid not null default gen_random_uuid();
alter table public.planner_settings drop constraint planner_settings_pkey;
alter table public.planner_settings add constraint planner_settings_pkey primary key(id);
alter table public.planner_settings add constraint planner_settings_notebook_id_key unique(notebook_id);
alter table public.planner_settings add constraint planner_settings_notebook_owner_fkey
foreign key(notebook_id,user_id) references public.notebooks(id,user_id) on delete cascade;

commit;
