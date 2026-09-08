-- =============================================
-- Starpie — Arkadaşlık Sistemi SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. friendships tablosunu oluştur
create table if not exists public.friendships (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users on delete cascade not null,
  receiver_id uuid references auth.users on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'rejected')) default 'pending' not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  -- Aynı çift için tek kayıt olabilir
  constraint unique_friendship unique (sender_id, receiver_id),
  -- Kendine arkadaşlık isteği gönderilemez
  constraint no_self_friendship check (sender_id != receiver_id)
);

-- 2. Index'ler (performans için)
create index if not exists friendships_sender_idx on public.friendships(sender_id);
create index if not exists friendships_receiver_idx on public.friendships(receiver_id);
create index if not exists friendships_status_idx on public.friendships(status);

-- 3. Row Level Security aktif et
alter table public.friendships enable row level security;

-- 4. RLS Politikaları

-- Kullanıcılar sadece kendi arkadaşlık kayıtlarını görebilir
create policy "Users can view own friendships"
  on public.friendships for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Kullanıcılar arkadaşlık isteği gönderebilir (sender_id kendi id'si olmalı)
create policy "Users can send friend requests"
  on public.friendships for insert
  with check (auth.uid() = sender_id);

-- Alıcı kabul/ret edebilir; gönderen iptal edebilir
create policy "Users can update relevant friendships"
  on public.friendships for update
  using (auth.uid() = receiver_id or auth.uid() = sender_id);

-- Kullanıcılar kendi gönderdikleri veya aldıkları istekleri silebilir
create policy "Users can delete own friendships"
  on public.friendships for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
