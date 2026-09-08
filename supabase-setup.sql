-- =============================================
-- Starpie — Supabase Kurulum SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. profiles tablosunu oluştur
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  profession text,
  bio text,
  avatar_url text,
  updated_at timestamp with time zone default now()
);

-- 2. Row Level Security aktif et
alter table public.profiles enable row level security;

-- 3. Politikalar
-- Herkes profilleri görüntüleyebilir
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Kullanıcılar kendi profillerini oluşturabilir
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Kullanıcılar kendi profillerini güncelleyebilir
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- =============================================
-- Storage Kurulumu (Dashboard > Storage'da yap)
-- 1. "avatars" adında yeni bucket oluştur
-- 2. "Public bucket" seçeneğini aktif et
-- =============================================

-- Eğer SQL ile storage bucket oluşturmak istersen:
-- insert into storage.buckets (id, name, public)
-- values ('avatars', 'avatars', true);

-- Storage politikaları
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
