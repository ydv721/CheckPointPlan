-- Index the user ownership foreign key for efficient account-level cascades.
create index markdown_notes_user_id_idx
  on public.markdown_notes(user_id);
