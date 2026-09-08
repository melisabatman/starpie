-- =============================================
-- Starpie — Tarot Falı (Tarot Readings) SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. tarot_readings tablosunu oluştur
create table if not exists public.tarot_readings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  question text not null check (char_length(question) > 0 and char_length(question) <= 300),
  cards jsonb not null,
  summary text not null,
  created_at timestamp with time zone default now() not null
);

-- Index'ler (Kullanıcının geçmiş fallarını kronolojik hızlı listelemek için)
create index if not exists tarot_readings_user_idx on public.tarot_readings(user_id);
create index if not exists tarot_readings_created_idx on public.tarot_readings(created_at desc);

-- 2. Row Level Security (RLS) aktif et
alter table public.tarot_readings enable row level security;

-- 3. RLS Politikaları (SADECE kullanıcının kendi fallarına özel gizlilik)

-- SELECT: Kullanıcı SADECE kendi geçmiş fallarını görebilir
create policy "Users can view own tarot readings"
  on public.tarot_readings for select
  using (auth.uid() = user_id);

-- INSERT: Kullanıcı sadece kendi adına fal kaydı oluşturabilir
create policy "Users can insert own tarot readings"
  on public.tarot_readings for insert
  with check (auth.uid() = user_id);

-- DELETE: Kullanıcı sadece kendi geçmiş falını silebilir
create policy "Users can delete own tarot readings"
  on public.tarot_readings for delete
  using (auth.uid() = user_id);
