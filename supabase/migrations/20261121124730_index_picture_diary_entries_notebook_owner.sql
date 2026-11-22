-- Add a covering index for the picture diary notebook ownership foreign key.
create index if not exists picture_diary_entries_notebook_owner_idx
  on public.picture_diary_entries (notebook_id, user_id);
