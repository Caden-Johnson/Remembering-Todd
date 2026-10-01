-- Todd Memorial submission backend for Supabase
-- Run this in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.memory_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null unique,
  name text,
  relationship text,
  story text,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.memory_submissions enable row level security;

-- Anonymous visitors may submit memories.
create policy "allow anonymous memory submissions"
on public.memory_submissions
for insert
to anon
with check (
  char_length(coalesce(name, '')) <= 200
  and char_length(coalesce(relationship, '')) <= 300
  and char_length(coalesce(story, '')) <= 12000
  and coalesce(array_length(photo_paths, 1), 0) <= 8
);

-- Intentionally no anonymous SELECT policy.
-- Visitors cannot read other people's submissions.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memorial-uploads',
  'memorial-uploads',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Anonymous visitors may upload into the private bucket.
create policy "allow anonymous memorial photo uploads"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'memorial-uploads'
);

-- No anonymous SELECT policy is created.
-- Photos remain private to the family/admin account.
