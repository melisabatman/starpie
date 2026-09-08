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
-- 3. EDGE FUNCTION WEBHOOK TALİMATLARI
-- ─────────────────────────────────────────────
-- Yeni bir mesaj eklendiğinde Supabase Edge Function'ı tetiklemek için:
--
-- 1. Supabase Dashboard > Database > Webhooks bölümüne gidin.
-- 2. "Create a new webhook" butonuna tıklayın:
--    - Name: send_message_email_notification
--    - Table: public.messages
--    - Events: INSERT
--    - Type: Supabase Edge Function
--    - Edge Function: send-message-email
--    - HTTP Method: POST
-- 3. Edge Function Secrets alanına Resend API anahtarınızı tanımlayın:
--    supabase secrets set RESEND_API_KEY=re_your_api_key
-- =============================================
