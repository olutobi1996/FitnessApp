-- PT Your Way — database schema
-- Run this once in your Supabase project's SQL editor:
-- Dashboard → SQL Editor → New query → paste this → Run

-- Stores the extra info we collect at sign up (name, role, specialism)
-- alongside each Supabase Auth user.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('client', 'pt')),
  specialism text,
  price numeric,
  bio text,
  photo_url text,
  online boolean default true,
  verified boolean default false,
  rating numeric default 5.0,
  reviews_count integer default 0,
  created_at timestamptz default now()
);

-- Turn on row level security so people can only ever edit their own row
alter table profiles enable row level security;

-- Anyone (including logged-out visitors) can view profiles —
-- this is what powers the public "find a trainer" directory
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

-- A logged-in user can create their own profile row (right after sign up)
create policy "Users can insert their own profile"
  on profiles for insert
  with check ( auth.uid() = id );

-- A logged-in user can update their own profile row (e.g. editing their bio)
create policy "Users can update their own profile"
  on profiles for update
  using ( auth.uid() = id );