-- TODD MEMORIAL OWNER-CONTROL SETUP
-- Safe to run again if you already ran previous versions.

create table if not exists public.memorial_settings (
  id text primary key,
  submissions_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.memorial_settings (id, submissions_open)
values ('site', true)
on conflict (id) do nothing;

alter table public.memorial_settings enable row level security;

-- Read access: public page + authenticated admin can see whether submissions are open.
revoke all on table public.memorial_settings from anon, authenticated;
grant select on table public.memorial_settings to anon, authenticated;

drop policy if exists "Anyone can read memorial settings" on public.memorial_settings;
create policy "Anyone can read memorial settings"
on public.memorial_settings
for select
to anon, authenticated
using (id = 'site');

-- Owner-only RPC. This is what the browser calls to pause/reopen submissions.
create or replace function public.set_memorial_submissions_open(new_open boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_memorial_owner() then
    raise exception 'Not authorized';
  end if;

  update public.memorial_settings
  set submissions_open = new_open,
      updated_at = now()
  where id = 'site';

  if not found then
    insert into public.memorial_settings (id, submissions_open, updated_at)
    values ('site', new_open, now());
  end if;

  return new_open;
end;
$$;

revoke all on function public.set_memorial_submissions_open(boolean) from public;
grant execute on function public.set_memorial_submissions_open(boolean) to authenticated;

-- Make sure the direct table cannot be updated by normal browser roles.
revoke update, insert, delete on table public.memorial_settings from anon, authenticated;
