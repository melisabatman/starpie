-- =============================================
-- Starpie — Admin Rolü & Köşe Yazıları (Admin Blog) SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. profiles tablosuna "role" kolonu ekle
alter table public.profiles 
  add column if not exists role text default 'user' not null 
  check (role in ('user', 'admin'));

-- 2. admin_posts (Köşe Yazıları) tablosunu oluştur
create table if not exists public.admin_posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references public.profiles(id) on delete cascade not null,
  title text not null check (char_length(title) > 0 and char_length(title) <= 200),
  content text not null check (char_length(content) > 0),
  excerpt text check (char_length(excerpt) <= 350),
  cover_image_url text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Index'ler (Kronolojik sıralama ve yazar araması için)
create index if not exists admin_posts_created_idx on public.admin_posts(created_at desc);
create index if not exists admin_posts_author_idx on public.admin_posts(author_id);

-- 3. Row Level Security (RLS) aktif et
alter table public.admin_posts enable row level security;

-- 4. RLS Politikaları

-- SELECT: Herkes köşe yazılarını görüntüleyebilir ve okuyabilir
create policy "Anyone can view admin posts"
  on public.admin_posts for select
  using (true);

-- INSERT: Sadece role = 'admin' olan kullanıcı yeni yazı ekleyebilir
create policy "Only admin can insert posts"
  on public.admin_posts for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- UPDATE: Sadece role = 'admin' olan yazar kendi yazısını düzenleyebilir
create policy "Only admin can update own posts"
  on public.admin_posts for update
  using (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- DELETE: Sadece role = 'admin' olan yazar kendi yazısını silebilir
create policy "Only admin can delete own posts"
  on public.admin_posts for delete
  using (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================
-- KENDİ HESABINI ADMIN YAPMAK İÇİN:
-- =============================================
-- Seçenek A (User ID ile):
-- update public.profiles set role = 'admin' where id = 'BURAYA_KENDI_USER_ID';

-- Seçenek B (Kayıtlı e-posta adresi ile):
-- update public.profiles set role = 'admin' where id = (
--   select id from auth.users where email = 'BURAYA_KENDI_EMAIL' limit 1
-- );
