create table public.journal_sticker_colors (
  user_id uuid not null references auth.users(id) on delete cascade,
  diary_date date not null,
  color text not null default 'green' check (color in ('green','red','blue','purple','gray')),
  primary key (user_id, diary_date)
);
alter table public.journal_sticker_colors enable row level security;
revoke all on public.journal_sticker_colors from anon, authenticated;
grant select, insert, update on public.journal_sticker_colors to authenticated;
create policy "Read own journal sticker colors" on public.journal_sticker_colors
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own journal sticker colors" on public.journal_sticker_colors
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own journal sticker colors" on public.journal_sticker_colors
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
