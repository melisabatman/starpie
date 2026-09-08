-- =============================================
-- Starpie — Ortak Alan Ruh Hali (Mood Entries) SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. mood_entries tablosunu oluştur
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

  -- Bir kullanıcı bir ortak alanda günde sadece bir ruh hali girebilir (güncelleme serbest)
  constraint unique_space_user_entry_date unique (space_id, user_id, entry_date)
);

-- Index'ler (Hızlı sorgulama ve geçmiş takvimi için)
create index if not exists mood_entries_space_idx on public.mood_entries(space_id);
create index if not exists mood_entries_date_idx on public.mood_entries(entry_date desc);
create index if not exists mood_entries_user_idx on public.mood_entries(user_id);

-- 2. Row Level Security aktif et
alter table public.mood_entries enable row level security;

-- 3. RLS Politikaları (SADECE Ortak Alan'daki iki kişi görebilir)

-- SELECT: Sadece kabul edilmiş ortak alanın iki partneri ruh hallerini görebilir
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

-- INSERT: Sadece kabul edilmiş ortak alanın partneri kendi adına ekleyebilir
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

-- UPDATE: Kullanıcı sadece kendi ruh halini güncelleyebilir
create policy "Users can update own mood entries"
  on public.mood_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: Kullanıcı sadece kendi ruh halini silebilir
create policy "Users can delete own mood entries"
  on public.mood_entries for delete
  using (auth.uid() = user_id);
