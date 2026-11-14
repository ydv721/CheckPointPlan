alter table public.planner_entries
  add column if not exists dday text not null default '';
