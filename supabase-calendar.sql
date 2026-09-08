-- =============================================
-- Starpie — Ortak Alan Takvim (Shared Events) SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. shared_events tablosunu oluştur
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

-- Index'ler (Tarih ve ortak alan sorguları için hızlı erişim)
create index if not exists shared_events_space_idx on public.shared_events(space_id);
create index if not exists shared_events_date_idx on public.shared_events(event_date asc);
create index if not exists shared_events_user_idx on public.shared_events(user_id);

-- 2. Row Level Security (RLS) aktif et
alter table public.shared_events enable row level security;

-- 3. RLS Politikaları (SADECE Ortak Alan'daki iki kişi görebilir ve yönetebilir)

-- SELECT: Sadece kabul edilmiş ortak alanın iki partneri takvim etkinliklerini görebilir
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

-- INSERT: Sadece kabul edilmiş ortak alanın partnerleri etkinlik ekleyebilir
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

-- UPDATE: Etkinliği ekleyen kişi güncelleyebilir
create policy "Users can update own shared events"
  on public.shared_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: Etkinliği ekleyen kişi silebilir
create policy "Users can delete own shared events"
  on public.shared_events for delete
  using (auth.uid() = user_id);
