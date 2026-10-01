-- Todd Memorial password-only, READ-ONLY admin dashboard.
-- Run this once in Supabase SQL Editor.

create table if not exists public.memorial_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.memorial_admins enable row level security;

-- Nobody browsing the site can inspect the admin allowlist.
revoke all on table public.memorial_admins from anon, authenticated;

create or replace function public.is_memorial_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memorial_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_memorial_admin() from public;
grant execute on function public.is_memorial_admin() to authenticated;

-- READ ONLY access to submitted memories.
revoke all on table public.memory_submissions from authenticated;
grant select on table public.memory_submissions to authenticated;

drop policy if exists "memorial admins can read submissions"
on public.memory_submissions;

create policy "memorial admins can read submissions"
on public.memory_submissions
for select
to authenticated
using (public.is_memorial_admin());

-- READ ONLY access to the private photo bucket.
drop policy if exists "memorial admins can read uploaded photos"
on storage.objects;

create policy "memorial admins can read uploaded photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'memorial-uploads'
  and public.is_memorial_admin()
);

-- There are intentionally NO UPDATE or DELETE policies for the admin page.
