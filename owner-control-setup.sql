-- Owner service controls for Todd's memorial site
-- Run this once in the Supabase SQL Editor.

create table if not exists public.memorial_settings (
  id text primary key,
  submissions_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.memorial_settings (id, submissions_open)
values ('site', true)
on conflict (id) do nothing;

alter table public.memorial_settings enable row level security;

-- Because this project does not automatically expose/grant new tables:
revoke all on table public.memorial_settings from anon, authenticated;
grant select on table public.memorial_settings to anon, authenticated;
grant update on table public.memorial_settings to authenticated;

drop policy if exists "Anyone can read memorial settings" on public.memorial_settings;
create policy "Anyone can read memorial settings"
on public.memorial_settings
for select
to anon, authenticated
using (id = 'site');

drop policy if exists "Owner can update memorial settings" on public.memorial_settings;
create policy "Owner can update memorial settings"
on public.memorial_settings
for update
to authenticated
using (public.is_memorial_owner())
with check (public.is_memorial_owner());
