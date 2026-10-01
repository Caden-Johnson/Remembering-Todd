-- Todd Memorial: family view password + private owner password
-- Run this in Supabase SQL Editor AFTER creating the owner Auth user.

-- Add a role column to the existing admin allowlist.
alter table public.memorial_admins
add column if not exists role text not null default 'viewer';

-- Keep roles constrained.
alter table public.memorial_admins
drop constraint if exists memorial_admins_role_check;

alter table public.memorial_admins
add constraint memorial_admins_role_check
check (role in ('viewer','owner'));

alter table public.memorial_admins enable row level security;
revoke all on table public.memorial_admins from anon, authenticated;

-- Return the signed-in user's admin role without exposing the allowlist table.
create or replace function public.get_memorial_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.memorial_admins
  where user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_memorial_role() from public;
grant execute on function public.get_memorial_role() to authenticated;

create or replace function public.is_memorial_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_memorial_role() in ('viewer','owner'), false);
$$;

create or replace function public.is_memorial_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_memorial_role() = 'owner', false);
$$;

revoke all on function public.is_memorial_viewer() from public;
revoke all on function public.is_memorial_owner() from public;
grant execute on function public.is_memorial_viewer() to authenticated;
grant execute on function public.is_memorial_owner() to authenticated;

-- TABLE PERMISSIONS
revoke all on table public.memory_submissions from authenticated;
grant select, delete on table public.memory_submissions to authenticated;

-- Everyone approved can read.
drop policy if exists "memorial admins can read submissions"
on public.memory_submissions;

create policy "memorial admins can read submissions"
on public.memory_submissions
for select
to authenticated
using (public.is_memorial_viewer());

-- Only owner can delete.
drop policy if exists "memorial owner can delete submissions"
on public.memory_submissions;

create policy "memorial owner can delete submissions"
on public.memory_submissions
for delete
to authenticated
using (public.is_memorial_owner());

-- PRIVATE PHOTO READ ACCESS
drop policy if exists "memorial admins can read uploaded photos"
on storage.objects;

create policy "memorial admins can read uploaded photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'memorial-uploads'
  and public.is_memorial_viewer()
);

-- OWNER PHOTO DELETE ACCESS
drop policy if exists "memorial owner can delete uploaded photos"
on storage.objects;

create policy "memorial owner can delete uploaded photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'memorial-uploads'
  and public.is_memorial_owner()
);

-- Make every existing approved admin a viewer by default.
update public.memorial_admins
set role = 'viewer'
where role is null or role not in ('viewer','owner');

-- NEXT: after creating owner-admin@rememberingtodd.local in Authentication,
-- run this separately with that user's UUID:
--
-- insert into public.memorial_admins (user_id, role)
-- values ('PASTE-OWNER-UUID-HERE', 'owner')
-- on conflict (user_id) do update set role = 'owner';
