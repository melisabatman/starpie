-- =============================================
-- Starpie — Beğeni, Yorum ve Yeniden Paylaşım (Repost) SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- ─────────────────────────────────────────────
-- 1. BEĞENİ TABLOSU (post_likes)
-- ─────────────────────────────────────────────
create table if not exists public.post_likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  constraint unique_post_like unique (post_id, user_id)
);

create index if not exists post_likes_post_id_idx on public.post_likes(post_id);
create index if not exists post_likes_user_id_idx on public.post_likes(user_id);

alter table public.post_likes enable row level security;

-- Beğenileri görme politikası: Gönderiyi görme hakkı olan (sahibi veya kabul edilmiş arkadaş) görebilir
drop policy if exists "Users and friends can view post likes" on public.post_likes;
create policy "Users and friends can view post likes"
  on public.post_likes for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_likes.post_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.friendships f
            where f.status = 'accepted'
              and (
                (f.sender_id = auth.uid() and f.receiver_id = p.user_id)
                or
                (f.receiver_id = auth.uid() and f.sender_id = p.user_id)
              )
          )
        )
    )
  );

-- Beğeni ekleme politikası: Sadece kendi adına ve yalnızca kendi veya kabul edilmiş arkadaşının gönderisine
drop policy if exists "Users can like friends posts or own posts" on public.post_likes;
create policy "Users can like friends posts or own posts"
  on public.post_likes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.posts p
      where p.id = post_likes.post_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.friendships f
            where f.status = 'accepted'
              and (
                (f.sender_id = auth.uid() and f.receiver_id = p.user_id)
                or
                (f.receiver_id = auth.uid() and f.sender_id = p.user_id)
              )
          )
        )
    )
  );

-- Beğeni silme (beğeniyi geri alma): Sadece kendi beğenisini silebilir
drop policy if exists "Users can remove own post likes" on public.post_likes;
create policy "Users can remove own post likes"
  on public.post_likes for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- 2. YORUM TABLOSU (post_comments)
-- ─────────────────────────────────────────────
create table if not exists public.post_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null check (char_length(content) > 0 and char_length(content) <= 300),
  created_at timestamp with time zone default now() not null
);

create index if not exists post_comments_post_id_idx on public.post_comments(post_id);
create index if not exists post_comments_created_at_idx on public.post_comments(created_at asc);

alter table public.post_comments enable row level security;

-- Yorumları görme politikası: Gönderiyi görebilenler yorumları da görebilir
drop policy if exists "Users and friends can view post comments" on public.post_comments;
create policy "Users and friends can view post comments"
  on public.post_comments for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.friendships f
            where f.status = 'accepted'
              and (
                (f.sender_id = auth.uid() and f.receiver_id = p.user_id)
                or
                (f.receiver_id = auth.uid() and f.sender_id = p.user_id)
              )
          )
        )
    )
  );

-- Yorum yapma politikası: Sadece kendi adına ve yalnızca kendi veya kabul edilmiş arkadaşının gönderisine
drop policy if exists "Users can comment on friends posts or own posts" on public.post_comments;
create policy "Users can comment on friends posts or own posts"
  on public.post_comments for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.friendships f
            where f.status = 'accepted'
              and (
                (f.sender_id = auth.uid() and f.receiver_id = p.user_id)
                or
                (f.receiver_id = auth.uid() and f.sender_id = p.user_id)
              )
          )
        )
    )
  );

-- Yorum silme: Yorum sahibi KENDİ yorumunu silebilir VEYA gönderi sahibi gönderisindeki HERHANGİ bir yorumu silebilir
drop policy if exists "Users can delete own comments or post owner can delete" on public.post_comments;
create policy "Users can delete own comments or post owner can delete"
  on public.post_comments for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id and p.user_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────
-- 3. YENİDEN PAYLAŞIM (REPOST) TABLOSU (post_reposts)
-- ─────────────────────────────────────────────
create table if not exists public.post_reposts (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  constraint unique_post_repost unique (post_id, user_id)
);

create index if not exists post_reposts_post_id_idx on public.post_reposts(post_id);
create index if not exists post_reposts_user_id_idx on public.post_reposts(user_id);
create index if not exists post_reposts_created_at_idx on public.post_reposts(created_at desc);

alter table public.post_reposts enable row level security;

-- Repost görme: Repostu yapan veya onun kabul edilmiş arkadaşları görebilir
drop policy if exists "Users and friends can view post reposts" on public.post_reposts;
create policy "Users and friends can view post reposts"
  on public.post_reposts for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = auth.uid() and f.receiver_id = post_reposts.user_id)
          or
          (f.receiver_id = auth.uid() and f.sender_id = post_reposts.user_id)
        )
    )
  );

-- Repost yapma: Sadece kendi adına ve yalnızca kendi veya kabul edilmiş arkadaşının gönderisini repost edebilir
drop policy if exists "Users can repost friends posts or own posts" on public.post_reposts;
create policy "Users can repost friends posts or own posts"
  on public.post_reposts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.posts p
      where p.id = post_reposts.post_id
        and (
          p.user_id = auth.uid()
          or exists (
            select 1 from public.friendships f
            where f.status = 'accepted'
              and (
                (f.sender_id = auth.uid() and f.receiver_id = p.user_id)
                or
                (f.receiver_id = auth.uid() and f.sender_id = p.user_id)
              )
          )
        )
    )
  );

-- Repost geri alma: Sadece kendi repostunu silebilir
drop policy if exists "Users can delete own reposts" on public.post_reposts;
create policy "Users can delete own reposts"
  on public.post_reposts for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- 4. GÖNDERİLER (posts) RLS POLİTİKASI GÜNCELLEMESİ
-- ─────────────────────────────────────────────
-- 4. posts TABLOSU SELECT POLİTİKASI GÜNCELLEMESİ
-- Arkadaşın yeniden paylaştığı gönderilerin akışta ve profilde görünmesi için:
drop policy if exists "Users and friends can view posts" on public.posts;
create policy "Users and friends can view posts"
  on public.posts for select
  using (
    auth.uid() = user_id
    OR
    exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = auth.uid() and f.receiver_id = posts.user_id)
          or
          (f.receiver_id = auth.uid() and f.sender_id = posts.user_id)
        )
    )
    OR
    exists (
      select 1
      from public.post_reposts pr
      join public.friendships f on (
        (f.sender_id = auth.uid() and f.receiver_id = pr.user_id)
        or
        (f.receiver_id = auth.uid() and f.sender_id = pr.user_id)
      )
      where pr.post_id = posts.id
        and f.status = 'accepted'
    )
  );


-- ─────────────────────────────────────────────
-- 5. METİN BİÇİMLENDİRME (RICH TEXT) UYUMLULUĞU
-- ─────────────────────────────────────────────
-- Kalın (B), İtalik (I) ve Altı Çizili (U) HTML etiketleri için içerik sınırı genişletmesi:
alter table if exists public.posts drop constraint if exists posts_content_check;
alter table if exists public.posts add constraint posts_content_check check (char_length(content) > 0 and char_length(content) <= 3000);

alter table if exists public.post_comments drop constraint if exists post_comments_content_check;
alter table if exists public.post_comments add constraint post_comments_content_check check (char_length(content) > 0 and char_length(content) <= 2000);
