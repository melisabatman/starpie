-- =============================================
-- Starpie — Ortak Alan Günlük (Journal Entries) SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. journal_entries tablosunu oluştur
create table if not exists public.journal_entries (
  id uuid default gen_random_uuid() primary key,
  space_id uuid references public.couple_spaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text check (char_length(title) <= 150),
  content text not null check (char_length(content) > 0),
  image_url text,
  entry_date date default current_date not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Index'ler (Ortak alan ve kronolojik sıralama sorguları için)
create index if not exists journal_entries_space_idx on public.journal_entries(space_id);
create index if not exists journal_entries_date_idx on public.journal_entries(entry_date desc);
create index if not exists journal_entries_created_at_idx on public.journal_entries(created_at desc);
create index if not exists journal_entries_user_idx on public.journal_entries(user_id);

-- 2. Row Level Security (RLS) aktif et
alter table public.journal_entries enable row level security;

-- 3. RLS Politikaları (SADECE Ortak Alan'daki kabul edilmiş iki kişi görebilir ve yönetebilir)

-- SELECT: Sadece kabul edilmiş ortak alanın partnerleri günlük yazılarını görebilir
create policy "Partners can view journal entries"
  on public.journal_entries for select
  using (
    exists (
      select 1 from public.couple_spaces s
      where s.id = journal_entries.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
    )
  );

-- INSERT: Sadece kabul edilmiş ortak alanın partnerleri günlük yazısı ekleyebilir
create policy "Partners can insert journal entries"
  on public.journal_entries for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.couple_spaces s
      where s.id = journal_entries.space_id
        and s.status = 'accepted'
        and (s.user1_id = auth.uid() or s.user2_id = auth.uid())
    )
  );

-- UPDATE: Kendi eklediği günlük yazısını güncelleyebilir
create policy "Users can update own journal entries"
  on public.journal_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: Kendi eklediği günlük yazısını silebilir
create policy "Users can delete own journal entries"
  on public.journal_entries for delete
  using (auth.uid() = user_id);
