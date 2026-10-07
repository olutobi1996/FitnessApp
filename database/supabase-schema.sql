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

  -- PT Your Way: launch features. Run ONCE in Supabase > SQL Editor > New query > Run.

-- 1. PRIVACY: stop the public reading every profile column (phone, address, postcode).
--    Public trainer info now comes only from the public_trainers view.
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Users can read their own profile" on profiles for select using ( auth.uid() = id );

create or replace view public.public_trainers as
  select id, name, specialism, photo_url, bio, city, price, online, verified, rating, reviews_count
  from public.profiles
  where role = 'pt';
grant select on public.public_trainers to anon, authenticated;

-- 2. SECURITY: users may edit their own details, but never their own rating, verified badge or role.
revoke update on profiles from authenticated;
grant update (name, specialism, price, bio, photo_url, phone, address_line, city, postcode, goals, updated_at)
  on profiles to authenticated;

-- 3. Saved trainers (synced across devices)
create table if not exists favourites (
  user_id uuid references auth.users(id) on delete cascade,
  trainer_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, trainer_id)
);
alter table favourites enable row level security;
create policy "Manage own favourites" on favourites for all using ( auth.uid() = user_id ) with check ( auth.uid() = user_id );

-- 4. Booking (consultation) requests
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  pt_id uuid not null references profiles(id) on delete cascade,
  client_name text,
  pt_name text,
  note text not null check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now()
);
alter table bookings enable row level security;
create policy "Parties can view bookings" on bookings for select using ( auth.uid() in (client_id, pt_id) );
create policy "Clients create bookings" on bookings for insert with check ( auth.uid() = client_id );
create policy "Trainers update booking status" on bookings for update using ( auth.uid() = pt_id ) with check ( auth.uid() = pt_id );
revoke update on bookings from authenticated;
grant update (status) on bookings to authenticated;

-- 5. Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  sender_name text,
  recipient_name text,
  body text not null check (char_length(body) <= 1000),
  read boolean not null default false,
  created_at timestamptz default now()
);
alter table messages enable row level security;
create policy "Parties can view messages" on messages for select using ( auth.uid() in (sender_id, recipient_id) );
create policy "Send as yourself" on messages for insert with check ( auth.uid() = sender_id );
create policy "Recipient marks read" on messages for update using ( auth.uid() = recipient_id ) with check ( auth.uid() = recipient_id );
revoke update on messages from authenticated;
grant update (read) on messages to authenticated;

-- 6. Reviews: only a client with an ACCEPTED booking can review that trainer, once.
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references profiles(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  client_name text,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) <= 600),
  created_at timestamptz default now(),
  unique (trainer_id, client_id)
);
alter table reviews enable row level security;
create policy "Reviews are public" on reviews for select using ( true );
create policy "Clients review accepted bookings" on reviews for insert with check (
  auth.uid() = client_id and exists (
    select 1 from bookings b where b.client_id = auth.uid() and b.pt_id = trainer_id and b.status = 'accepted')
);

-- keep each trainer's average rating + review count up to date automatically
create or replace function public.refresh_trainer_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles set
    rating = (select round(avg(rating)::numeric, 1) from reviews where trainer_id = new.trainer_id),
    reviews_count = (select count(*) from reviews where trainer_id = new.trainer_id)
  where id = new.trainer_id;
  return new;
end $$;
drop trigger if exists reviews_refresh on reviews;
create trigger reviews_refresh after insert on reviews for each row execute function public.refresh_trainer_rating();