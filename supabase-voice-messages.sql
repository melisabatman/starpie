-- =============================================
-- Starpie — Sesli Mesaj (Voice Messages) SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. messages tablosuna sesli mesaj kolonlarını ekle
alter table public.messages 
  add column if not exists message_type text default 'text' check (message_type in ('text', 'audio')),
  add column if not exists audio_url text;

-- 2. content kolonunu sesli mesajlar için opsiyonel yap
alter table public.messages alter column content drop not null;

-- 3. "voice-messages" Storage Bucket'ı oluştur (Public erişim)
insert into storage.buckets (id, name, public)
values ('voice-messages', 'voice-messages', true)
on conflict (id) do update set public = true;

-- 4. Storage RLS Politikaları

-- Ses dosyalarını herkes dinleyebilir (public URL)
create policy "Voice messages are publicly readable"
  on storage.objects for select
  using (bucket_id = 'voice-messages');

-- Giriş yapmış kullanıcılar sesli mesaj yükleyebilir
create policy "Authenticated users can upload voice messages"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-messages'
    and auth.role() = 'authenticated'
  );

-- Kullanıcılar kendi ses kayıtlarını silebilir
create policy "Users can delete own voice messages"
  on storage.objects for delete
  using (
    bucket_id = 'voice-messages'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
