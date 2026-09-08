-- =============================================
-- Starpie — Birebir Mesajlaşma (Messages) Sistemi SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştır
-- =============================================

-- 1. messages tablosunu oluştur
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users on delete cascade not null,
  receiver_id uuid references auth.users on delete cascade not null,
  content text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  is_read boolean default false not null,
  created_at timestamp with time zone default now() not null,
  
  -- Kendine mesaj gönderilemez
  constraint no_self_messaging check (sender_id != receiver_id)
);

-- 2. Index'ler (Hızlı sorgulama ve sohbet akışı performansı için)
create index if not exists messages_sender_receiver_idx on public.messages(sender_id, receiver_id);
create index if not exists messages_receiver_sender_idx on public.messages(receiver_id, sender_id);
create index if not exists messages_created_at_idx on public.messages(created_at asc);

-- 3. Row Level Security aktif et
alter table public.messages enable row level security;

-- 4. RLS Politikaları

-- SELECT: Kullanıcı sadece göndericisi veya alıcısı olduğu VE 
--         aralarında kabul edilmiş (status = 'accepted') arkadaşlık bulunan mesajları görebilir
create policy "Users can view messages with accepted friends"
  on public.messages for select
  using (
    (auth.uid() = sender_id or auth.uid() = receiver_id)
    and exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.sender_id = messages.sender_id and f.receiver_id = messages.receiver_id)
          or
          (f.receiver_id = messages.sender_id and f.sender_id = messages.receiver_id)
        )
    )
  );

-- INSERT: Kullanıcı sadece kendi adına mesaj gönderebilir VE 
--         alıcıyla aralarında kabul edilmiş arkadaşlık olmak zorundadır
create policy "Users can send messages to accepted friends"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
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

-- UPDATE: Sadece mesajın alıcısı okundu (is_read) durumunu güncelleyebilir
create policy "Receivers can mark messages as read"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- DELETE: Gönderen kendi mesajını silebilir
create policy "Users can delete own sent messages"
  on public.messages for delete
  using (auth.uid() = sender_id);

-- =============================================
-- 5. Supabase Realtime Yapılandırması
-- =============================================
-- Realtime dinlemelerinde tam kayıt bilgisinin iletilmesi için:
alter table public.messages replica identity full;

-- messages tablosunu supabase_realtime yayınına ekle:
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- =============================================
-- 6. Sesli Mesaj (Voice Messages) Eklentisi
-- =============================================
alter table public.messages 
  add column if not exists message_type text default 'text' check (message_type in ('text', 'audio')),
  add column if not exists audio_url text;

alter table public.messages alter column content drop not null;

-- "voice-messages" Storage Bucket'ı
insert into storage.buckets (id, name, public)
values ('voice-messages', 'voice-messages', true)
on conflict (id) do update set public = true;

create policy "Voice messages are publicly readable"
  on storage.objects for select
  using (bucket_id = 'voice-messages');

create policy "Authenticated users can upload voice messages"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-messages'
    and auth.role() = 'authenticated'
  );

create policy "Users can delete own voice messages"
  on storage.objects for delete
  using (
    bucket_id = 'voice-messages'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

