-- =============================================
-- Starpie — Ortak Alan (Couple Space) & Polaroid Galeri SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. couple_spaces tablosunu oluştur
create table if not exists public.couple_spaces (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references auth.users on delete cascade not null,
  user2_id uuid references auth.users on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'rejected')) default 'pending' not null,
  title text default 'Bizim Alanımız' not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,

  -- Kendisiyle alan kurulamaz
  constraint no_self_space check (user1_id != user2_id)
);

-- Aynı iki kullanıcı arasında tek bir aktif veya bekleyen alan olabilir
create unique index if not exists unique_couple_pair_idx 
  on public.couple_spaces (least(user1_id, user2_id), greatest(user1_id, user2_id))
  where status in ('pending', 'accepted');

-- Index'ler
create index if not exists couple_spaces_user1_idx on public.couple_spaces(user1_id);
create index if not exists couple_spaces_user2_idx on public.couple_spaces(user2_id);
create index if not exists couple_spaces_status_idx on public.couple_spaces(status);

-- 2. couple_memories (Polaroid Anılar) tablosunu oluştur
create table if not exists public.couple_memories (
  id uuid default gen_random_uuid() primary key,
  space_id uuid references public.couple_spaces on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  image_url text not null,
  caption text check (char_length(caption) <= 280),
  memory_date date default current_date not null,
  rotation numeric default 0 not null,
  created_at timestamp with time zone default now() not null
);

-- Index'ler
create index if not exists couple_memories_space_idx on public.couple_memories(space_id);
create index if not exists couple_memories_created_at_idx on public.couple_memories(created_at desc);

-- 3. Row Level Security aktif et
alter table public.couple_spaces enable row level security;
alter table public.couple_memories enable row level security;

-- 4. RLS Politikaları — couple_spaces

-- SELECT: Yalnızca alana dahil iki kullanıcı görebilir
create policy "Users can view own couple spaces"
  on public.couple_spaces for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);

-- INSERT: Yalnızca gönderen (user1) ekleyebilir ve alıcıyla arkadaş olmalıdır
create policy "Users can invite friends to couple space"
  on public.couple_spaces for insert
  with check (
    auth.uid() = user1_id
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = auth.uid() and f.receiver_id = couple_spaces.user2_id)
          or (f.receiver_id = auth.uid() and f.sender_id = couple_spaces.user2_id)
        )
    )
  );

-- UPDATE: Alıcı daveti kabul/ret edebilir; gönderen güncelleyebilir
create policy "Partners can update couple space"
  on public.couple_spaces for update
  using (auth.uid() = user1_id or auth.uid() = user2_id)
  with check (auth.uid() = user1_id or auth.uid() = user2_id);

-- DELETE: Taraflardan biri alanı silebilir/kapatabilir
create policy "Partners can delete couple space"
  on public.couple_spaces for delete
  using (auth.uid() = user1_id or auth.uid() = user2_id);

-- 5. RLS Politikaları — couple_memories (SADECE bu iki kullanıcı erişebilir)

-- SELECT: SADECE o ortak alanın kabul edilmiş partnerleri anıları görebilir
create policy "Only space partners can view memories"
  on public.couple_memories for select
  using (
    exists (
      select 1 from public.couple_spaces s
      where s.id = couple_memories.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
    )
  );

-- INSERT: SADECE ortak alanın kabul edilmiş partnerleri anı ekleyebilir
create policy "Only space partners can create memories"
  on public.couple_memories for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.couple_spaces s
      where s.id = couple_memories.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
      )
  );

-- DELETE: Yükleyen veya alanın partneri anıyı silebilir
create policy "Partners can delete memories"
  on public.couple_memories for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.couple_spaces s
      where s.id = couple_memories.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
    )
  );

-- =============================================
-- 6. Storage: "couple-memories" Bucket
-- =============================================
insert into storage.buckets (id, name, public)
values ('couple-memories', 'couple-memories', true)
on conflict (id) do update set public = true;

create policy "Couple memories are publicly readable"
  on storage.objects for select
  using (bucket_id = 'couple-memories');

create policy "Authenticated users can upload couple memories"
  on storage.objects for insert
  with check (
    bucket_id = 'couple-memories'
    and auth.role() = 'authenticated'
  );

create policy "Users can delete own couple memories"
  on storage.objects for delete
  using (
    bucket_id = 'couple-memories'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- =============================================
-- 7. mood_entries (Ruh Hali) Tablosu
-- =============================================
create table if not exists public.mood_entries (
  id uuid default gen_random_uuid() primary key,
  space_id uuid references public.couple_spaces on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  emoji text not null,
  mood_label text not null,
  note text check (char_length(note) <= 140),
  entry_date date default current_date not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint unique_space_user_entry_date unique (space_id, user_id, entry_date)
);

create index if not exists mood_entries_space_idx on public.mood_entries(space_id);
create index if not exists mood_entries_date_idx on public.mood_entries(entry_date desc);
create index if not exists mood_entries_user_idx on public.mood_entries(user_id);

alter table public.mood_entries enable row level security;

create policy "Partners can view mood entries"
  on public.mood_entries for select
  using (
    exists (
      select 1 from public.couple_spaces s
      where s.id = mood_entries.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
    )
  );

create policy "Partners can insert own mood entries"
  on public.mood_entries for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.couple_spaces s
      where s.id = mood_entries.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
    )
  );

create policy "Users can update own mood entries"
  on public.mood_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own mood entries"
  on public.mood_entries for delete
  using (auth.uid() = user_id);

-- =============================================
-- 8. shared_events (Ortak Takvim & Notlar) Tablosu
-- =============================================
create table if not exists public.shared_events (
  id uuid default gen_random_uuid() primary key,
  space_id uuid references public.couple_spaces on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  title text not null check (char_length(title) > 0 and char_length(title) <= 120),
  description text check (char_length(description) <= 500),
  event_date date not null,
  event_time time,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create index if not exists shared_events_space_idx on public.shared_events(space_id);
create index if not exists shared_events_date_idx on public.shared_events(event_date asc);
create index if not exists shared_events_user_idx on public.shared_events(user_id);

alter table public.shared_events enable row level security;

create policy "Partners can view shared events"
  on public.shared_events for select
  using (
    exists (
      select 1 from public.couple_spaces s
      where s.id = shared_events.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
    )
  );

create policy "Partners can insert shared events"
  on public.shared_events for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.couple_spaces s
      where s.id = shared_events.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
    )
  );

create policy "Users can update own shared events"
  on public.shared_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own shared events"
  on public.shared_events for delete
  using (auth.uid() = user_id);

