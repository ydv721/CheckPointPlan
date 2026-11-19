alter table public.planner_entries
  add column if not exists color_labels jsonb not null
  default '["","","","",""]'::jsonb;
