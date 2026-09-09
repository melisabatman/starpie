-- ==============================================================================
-- Starpie: Kapsamlı Kurulum & Bildirim & Admin SQL Özeti
-- Supabase Dashboard > SQL Editor sekmesinde çalıştırın.
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. PROFILES TABLOSU GÜNCELLEMELERİ
-- ──────────────────────────────────────────────────────────────────────────────

-- A) Role kolonu ekle (Admin & Kullanıcı yetkilendirmesi için)
alter table public.profiles 
  add column if not exists role text default 'user' not null 
  check (role in ('user', 'admin'));

-- B) E-posta bildirim tercihi kolonu ekle
alter table public.profiles 
  add column if not exists email_notifications_enabled boolean default true not null;

-- C) Son görülme (çevrimiçi kontrolü için) kolonu ekle
alter table public.profiles 
  add column if not exists last_seen_at timestamp with time zone default now();

-- D) Hızlı e-posta sorguları için profiles tablosuna email kolonu ekle
alter table public.profiles 
  add column if not exists email text;

-- auth.users tablosundaki mevcut e-postaları profiles tablosuna eşitle:
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Yeni kayıt olan kullanıcıların e-postalarını otomatik profiles tablosuna yazacak trigger fonksiyonu:
create or replace function public.handle_new_user_email_sync()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_sync on auth.users;
create trigger on_auth_user_email_sync
  after insert or update of email on auth.users
  for each row
  execute function public.handle_new_user_email_sync();


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. ADMİN KÖŞE YAZILARI (admin_posts) TABLOSU & RLS
-- ──────────────────────────────────────────────────────────────────────────────

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

create index if not exists admin_posts_created_idx on public.admin_posts(created_at desc);
create index if not exists admin_posts_author_idx on public.admin_posts(author_id);

alter table public.admin_posts enable row level security;

-- Herkes köşe yazılarını okuyabilir
drop policy if exists "Anyone can view admin posts" on public.admin_posts;
create policy "Anyone can view admin posts"
  on public.admin_posts for select
  using (true);

-- Yalnızca role = 'admin' olanlar yazı ekleyebilir
drop policy if exists "Only admin can insert posts" on public.admin_posts;
create policy "Only admin can insert posts"
  on public.admin_posts for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Yalnızca yazının sahibi olan admin güncelleyebilir
drop policy if exists "Only admin can update own posts" on public.admin_posts;
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

-- Yalnızca yazının sahibi olan admin silebilir
drop policy if exists "Only admin can delete own posts" on public.admin_posts;
create policy "Only admin can delete own posts"
  on public.admin_posts for delete
  using (
    auth.uid() = author_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. STORAGE: "admin-posts" BUCKET & POLİTİKALARI
-- ──────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('admin-posts', 'admin-posts', true)
on conflict (id) do update set public = true;

drop policy if exists "Admin blog images are publicly accessible" on storage.objects;
create policy "Admin blog images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'admin-posts');

drop policy if exists "Only admin can upload admin blog images" on storage.objects;
create policy "Only admin can upload admin blog images"
  on storage.objects for insert
  with check (
    bucket_id = 'admin-posts'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Only admin can delete admin blog images" on storage.objects;
create policy "Only admin can delete admin blog images"
  on storage.objects for delete
  using (
    bucket_id = 'admin-posts'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );


-- ──────────────────────────────────────────────────────────────────────────────
-- 4. REALTIME: ANLIK MESAJ VE SİTE İÇİ BİLDİRİMLER İÇİN YAYIN
-- ──────────────────────────────────────────────────────────────────────────────

-- Sitede gezinirken gelen mesajları anlık yakalayıp "✨ Yeni bir mesajınız var"
-- bildirimini ve bildirim sayacını tetiklemek için messages tablosunu Realtime'a ekle:
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;


-- ──────────────────────────────────────────────────────────────────────────────
-- 5. KULLANICIYI ADMİN YAPMA SORGULARI
-- ──────────────────────────────────────────────────────────────────────────────

-- SADECE belirli bir e-posta adresini admin yapmak için (örn. melisabatman1992@gmail.com):
-- update public.profiles 
-- set role = 'admin' 
-- where id in (select id from auth.users where email = 'melisabatman1992@gmail.com');

-- Diğer kullanıcıları normal 'user' rolüne döndürmek için:
-- update public.profiles set role = 'user' where id not in (select id from auth.users where email = 'melisabatman1992@gmail.com');

