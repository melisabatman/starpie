-- =============================================
-- Starpie — Profil "Zaman Tüneli" (Facebook Duvarı) SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- =============================================

-- ─────────────────────────────────────────────
-- 1. ZAMAN TÜNELİ TABLOSU (timeline_posts)
-- ─────────────────────────────────────────────
create table if not exists public.timeline_posts (
  id uuid default gen_random_uuid() primary key,
  wall_user_id uuid references auth.users(id) on delete cascade not null,
  author_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default now() not null
);

-- Hızlı sorgular için indeksler
create index if not exists timeline_posts_wall_user_id_idx on public.timeline_posts(wall_user_id, created_at desc);
create index if not exists timeline_posts_author_id_idx on public.timeline_posts(author_id);

-- RLS (Satır Düzeyi Güvenlik) etkinleştirme
alter table public.timeline_posts enable row level security;

-- ─────────────────────────────────────────────
-- 2. GÖRÜNTÜLEME (SELECT) POLİTİKASI
-- Sadece profil sahibi, yazar veya kabul edilmiş arkadaşlar görebilir
-- ─────────────────────────────────────────────
drop policy if exists "Users and friends can view timeline posts" on public.timeline_posts;
create policy "Users and friends can view timeline posts"
  on public.timeline_posts for select
  using (
    -- Profilin sahibi görebilir
    wall_user_id = auth.uid()
    -- Mesajı yazan kişi görebilir
    or author_id = auth.uid()
    -- Profil sahibinin kabul edilmiş arkadaşları görebilir
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = auth.uid() and f.receiver_id = timeline_posts.wall_user_id)
          or
          (f.receiver_id = auth.uid() and f.sender_id = timeline_posts.wall_user_id)
        )
    )
  );

-- ─────────────────────────────────────────────
-- 3. EKLEME (INSERT) POLİTİKASI
-- Sadece kendi adına (auth.uid = author_id) ve yalnızca
-- kendi duvarına veya kabul edilmiş arkadaşının duvarına yazabilir
-- ─────────────────────────────────────────────
drop policy if exists "Users and friends can write on timeline" on public.timeline_posts;
create policy "Users and friends can write on timeline"
  on public.timeline_posts for insert
  with check (
    -- Yazar giriş yapmış kullanıcının kendisi olmalıdır
    auth.uid() = author_id
    and (
      -- Kendi zaman tüneline yazabilir
      wall_user_id = auth.uid()
      -- Veya kabul edilmiş arkadaşının zaman tüneline yazabilir
      or exists (
        select 1 from public.friendships f
        where f.status = 'accepted'
          and (
            (f.sender_id = auth.uid() and f.receiver_id = timeline_posts.wall_user_id)
            or
            (f.receiver_id = auth.uid() and f.sender_id = timeline_posts.wall_user_id)
          )
      )
    )
  );

-- ─────────────────────────────────────────────
-- 4. SİLME (DELETE) POLİTİKASI
-- Profil sahibi (kendi tünelindeki herhangi bir mesajı) VEYA
-- mesajı yazan yazar silebilir
-- ─────────────────────────────────────────────
drop policy if exists "Wall owners and authors can delete timeline posts" on public.timeline_posts;
create policy "Wall owners and authors can delete timeline posts"
  on public.timeline_posts for delete
  using (
    -- Duvar sahibi silebilir
    wall_user_id = auth.uid()
    -- Veya mesajı yazan kişi kendi mesajını silebilir
    or author_id = auth.uid()
  );
