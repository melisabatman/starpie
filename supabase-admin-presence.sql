-- =============================================
-- Starpie — Admin Yetkileri, Kullanıcı Banlama & Çevrimiçi/Görüldü SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- =============================================

-- ─────────────────────────────────────────────
-- 1. profiles TABLOSUNA is_banned KOLONU EKLE
-- ─────────────────────────────────────────────
alter table public.profiles 
  add column if not exists is_banned boolean default false not null;

create index if not exists profiles_is_banned_idx on public.profiles(is_banned);

-- ─────────────────────────────────────────────
-- 2. GÜVENLİ ADMIN YARDIMCI FONKSİYONU (is_admin)
-- Security Definer sayesinde RLS sonsuz döngüye girmeden profiles tablosunu okur
-- ─────────────────────────────────────────────
create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────
-- 3. GÖNDERİLER (posts) RLS POLİTİKALARI GÜNCELLEMESİ
-- Adminler tüm gönderileri silebilir, banlı kullanıcılar gönderi atamaz
-- ─────────────────────────────────────────────

-- DELETE: Gönderi sahibi VEYA admin silebilir
drop policy if exists "Users can delete own posts" on public.posts;
drop policy if exists "Users or admins can delete posts" on public.posts;
create policy "Users or admins can delete posts"
  on public.posts for delete
  using (
    auth.uid() = user_id 
    or public.is_admin()
  );

-- INSERT: Sadece banlanmamış kullanıcılar gönderi oluşturabilir
drop policy if exists "Users can create own posts" on public.posts;
create policy "Users can create own posts"
  on public.posts for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles
      where id = auth.uid() and is_banned = true
    )
  );

-- ─────────────────────────────────────────────
-- 4. YORUMLAR (post_comments) RLS POLİTİKALARI GÜNCELLEMESİ
-- Adminler tüm yorumları silebilir, banlı kullanıcılar yorum yazamaz
-- ─────────────────────────────────────────────

-- DELETE: Yorum sahibi, gönderi sahibi VEYA admin silebilir
drop policy if exists "Users can delete own comments or post owner can delete" on public.post_comments;
drop policy if exists "Users, post owners, or admins can delete comments" on public.post_comments;
create policy "Users, post owners, or admins can delete comments"
  on public.post_comments for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id and p.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- INSERT: Sadece banlanmamış kullanıcılar yorum yapabilir
drop policy if exists "Users can comment on friends posts or own posts" on public.post_comments;
create policy "Users can comment on friends posts or own posts"
  on public.post_comments for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles
      where id = auth.uid() and is_banned = true
    )
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

-- ─────────────────────────────────────────────
-- 5. ZAMAN TÜNELİ (timeline_posts) RLS POLİTİKALARI GÜNCELLEMESİ
-- Adminler tüm duvar yazılarını silebilir
-- ─────────────────────────────────────────────

-- DELETE: Duvar sahibi, yazar VEYA admin silebilir
drop policy if exists "Wall owners and authors can delete timeline posts" on public.timeline_posts;
drop policy if exists "Wall owners, authors, or admins can delete timeline posts" on public.timeline_posts;
create policy "Wall owners, authors, or admins can delete timeline posts"
  on public.timeline_posts for delete
  using (
    wall_user_id = auth.uid()
    or author_id = auth.uid()
    or public.is_admin()
  );

-- INSERT: Sadece banlanmamış kullanıcılar yazabilir
drop policy if exists "Users and friends can write on timeline" on public.timeline_posts;
create policy "Users and friends can write on timeline"
  on public.timeline_posts for insert
  with check (
    auth.uid() = author_id
    and not exists (
      select 1 from public.profiles
      where id = auth.uid() and is_banned = true
    )
    and (
      wall_user_id = auth.uid()
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
-- 6. MESAJLAR (messages) RLS POLİTİKALARI GÜNCELLEMESİ
-- Adminler mesaj silebilir/güncelleyebilir, banlı kullanıcılar mesaj atamaz
-- ─────────────────────────────────────────────

-- DELETE: Gönderen VEYA admin silebilir
drop policy if exists "Users can delete own sent messages" on public.messages;
drop policy if exists "Users or admins can delete messages" on public.messages;
create policy "Users or admins can delete messages"
  on public.messages for delete
  using (
    auth.uid() = sender_id 
    or public.is_admin()
  );

-- UPDATE: Alıcı (görüldü yapmak için) VEYA admin güncelleyebilir
drop policy if exists "Receivers can mark messages as read" on public.messages;
drop policy if exists "Receivers or admins can update messages" on public.messages;
create policy "Receivers or admins can update messages"
  on public.messages for update
  using (
    auth.uid() = receiver_id 
    or public.is_admin()
  )
  with check (
    auth.uid() = receiver_id 
    or public.is_admin()
  );

-- INSERT: Sadece banlanmamış kullanıcılar mesaj atabilir
drop policy if exists "Users can send messages to accepted friends" on public.messages;
create policy "Users can send messages to accepted friends"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.profiles
      where id = auth.uid() and is_banned = true
    )
    and exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = auth.uid() and f.receiver_id = messages.receiver_id)
          or
          (f.receiver_id = auth.uid() and f.sender_id = messages.receiver_id)
        )
    )
  );

-- ─────────────────────────────────────────────
-- 7. ARKADAŞLIKLAR (friendships) RLS POLİTİKALARI GÜNCELLEMESİ
-- Adminler istenmeyen arkadaşlıkları silebilir, banlı kullanıcılar istek atamaz
-- ─────────────────────────────────────────────

-- DELETE: İstek tarafları VEYA admin silebilir
drop policy if exists "Users can delete own friendships" on public.friendships;
drop policy if exists "Users or admins can delete friendships" on public.friendships;
create policy "Users or admins can delete friendships"
  on public.friendships for delete
  using (
    auth.uid() = sender_id 
    or auth.uid() = receiver_id 
    or public.is_admin()
  );

-- INSERT: Sadece banlanmamış kullanıcılar arkadaşlık isteği atabilir
drop policy if exists "Users can send friend requests" on public.friendships;
create policy "Users can send friend requests"
  on public.friendships for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.profiles
      where id = auth.uid() and is_banned = true
    )
  );

-- ─────────────────────────────────────────────
-- 8. REALTIME REPLICA IDENTITY VE YAYIN TEYİDİ
-- Görüldü (UPDATE) bilgisinin realtime ile iletilmesi için:
-- ─────────────────────────────────────────────
alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
