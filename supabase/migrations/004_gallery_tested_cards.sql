-- Shared gallery "tested" checklist for QA / playtesters (all clients read/write).

create table if not exists public.gallery_tested_cards (
  definition_id text primary key,
  marked_by text,
  marked_at timestamptz not null default now()
);

create index if not exists gallery_tested_cards_marked_at_idx
  on public.gallery_tested_cards (marked_at desc);

alter table public.gallery_tested_cards enable row level security;

drop policy if exists "gallery_tested_anon_all" on public.gallery_tested_cards;
create policy "gallery_tested_anon_all" on public.gallery_tested_cards
  for all using (true) with check (true);

-- Realtime so debug panels update when another tester marks a card.
do $$
begin
  alter publication supabase_realtime add table public.gallery_tested_cards;
exception
  when duplicate_object then null;
end $$;
