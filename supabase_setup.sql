-- Create a table for storing portals
create table if not exists portals (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  type text not null check (type in ('stalker', 'xtream', 'm3u')),
  last_used bigint,
  
  -- Stalker specific fields
  url text,
  mac text,
  
  -- Xtream specific fields
  server text,
  username text,
  password text,
  
  -- M3U specific fields
  playlist_url text
);

-- Enable Row Level Security (RLS)
alter table portals enable row level security;

-- Create a policy that allows anyone to read/write (since we don't have auth yet)
-- WARNING: This is for development/personal use only. In a real app, you'd want user authentication.
create policy "Allow public access"
  on portals
  for all
  using (true)
  with check (true);
