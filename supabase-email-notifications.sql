-- =============================================
-- Starpie — E-posta Bildirimleri & Çevrimdışı Durumu SQL'i
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- =============================================

-- ─────────────────────────────────────────────
-- 1. PROFİLLER TABLOSUNA BİLDİRİM VE PRESENCE KOLONLARI
-- ─────────────────────────────────────────────

-- E-posta bildirimleri açık mı? (varsayılan: true)
alter table public.profiles
  add column if not exists email_notifications_enabled boolean default true not null;

-- Son görülme / aktiflik zamanı (çevrimdışı tespiti için)
alter table public.profiles
  add column if not exists last_seen_at timestamp with time zone default now();

create index if not exists profiles_last_seen_at_idx on public.profiles(last_seen_at);

-- ─────────────────────────────────────────────
-- 2. KULLANICI AKTİFLİK GÜNCELLEME FONKSİYONU
-- ─────────────────────────────────────────────
create or replace function public.update_user_presence()
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid();
end;
$$;

-- ─────────────────────────────────────────────
-- 3. POSTGRESQL TRIGGER (MESSAGES -> EDGE FUNCTION)
-- ─────────────────────────────────────────────
-- pg_net eklentisi ile Edge Function'a asenkron HTTP POST atan trigger
create extension if not exists pg_net with schema extensions;

create or replace function public.on_message_inserted_send_email()
returns trigger
language plpgsql
security definer
as $$
declare
  edge_function_url text := 'https://croiubkhigvqlodzhcdv.supabase.co/functions/v1/send-message-email';
  anon_key text := 'sb_publishable_0ZjNQkba_OhWPPkKseMrXw_soKUGH6z';
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW)
  );

  perform net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload
  );

  return NEW;
end;
$$;

drop trigger if exists on_message_inserted_email_trigger on public.messages;

create trigger on_message_inserted_email_trigger
  after insert on public.messages
  for each row
  execute function public.on_message_inserted_send_email();

-- Doğrulama Sorgusu:
-- SELECT trigger_name, event_manipulation, event_object_table, action_statement 
-- FROM information_schema.triggers WHERE event_object_table = 'messages';
-- =============================================

