-- =============================================
-- Starpie — Gönderi (Posts) Sistemi SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. posts tablosunu oluştur
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text not null check (char_length(content) > 0 and char_length(content) <= 500),
  image_url text,
  created_at timestamp with time zone default now() not null
);

-- 2. Index'ler
create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);

-- 3. Row Level Security aktif et
alter table public.posts enable row level security;

-- 4. RLS Politikaları

-- SELECT: Kullanıcı kendi gönderilerini görebilir
--         VEYA kabul edilmiş (accepted) arkadaşının gönderilerini görebilir
create policy "Users and friends can view posts"
  on public.posts for select
  using (
    -- Kendi gönderisi
    auth.uid() = user_id
    OR
    -- Kabul edilmiş arkadaşlık var mı?
    exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = auth.uid()   and f.receiver_id = posts.user_id)
          or
          (f.receiver_id = auth.uid() and f.sender_id   = posts.user_id)
        )
    )
  );

-- INSERT: Kullanıcı sadece kendi adına gönderi ekleyebilir
create policy "Users can create own posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

-- DELETE: Kullanıcı sadece kendi gönderisini silebilir
create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

-- =============================================
-- Storage: "posts" Bucket
-- Supabase Dashboard > Storage > New Bucket
-- Name: posts   |   Public: ✅ aktif
-- =============================================

-- Storage politikaları (isteğe bağlı SQL ile oluşturma)
create policy "Post images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'posts');

create policy "Users can upload post images to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'posts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own post images"
  on storage.objects for delete
  using (
    bucket_id = 'posts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
