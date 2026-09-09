-- ============================================================
-- Starpie: Messages INSERT -> send-message-email Trigger
-- Supabase Dashboard > SQL Editor'da çalıştırın
-- ============================================================

-- 1. Asenkron HTTP istekleri için pg_net eklentisini aktif et
create extension if not exists pg_net with schema extensions;

-- 2. Trigger Fonksiyonunu Tanımla
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
  -- Edge Function'a iletilecek webhook yükü (payload)
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW)
  );

  -- pg_net ile arka planda asenkron HTTP POST isteği gönder (mesaj kaydını yavaşlatmaz)
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

-- 3. Varsa eski trigger'ı kaldır ve yenisini oluştur
drop trigger if exists on_message_inserted_email_trigger on public.messages;

create trigger on_message_inserted_email_trigger
  after insert on public.messages
  for each row
  execute function public.on_message_inserted_send_email();

-- ============================================================
-- DOĞRULAMA SORGUSU (Trigger'ın kurulduğunu teyit etmek için):
-- ============================================================
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'messages';
