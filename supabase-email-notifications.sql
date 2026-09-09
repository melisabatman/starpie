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
-- 3. E-POSTA BİLDİRİMİ İÇİN 2 FARKLI YÖNTEM
-- ─────────────────────────────────────────────
--
-- YÖNTEM A: Next.js Sunucu Tarafı (Önerilen & En Kolay - CLI/Deploy Gerektirmez)
-- 1. Supabase Dashboard > Project Settings > API bölümünden "service_role" gizli anahtarını kopyalayın.
-- 2. Projenizdeki `.env.local` dosyasına şu satırı ekleyin:
--    SUPABASE_SERVICE_ROLE_KEY=eyJh... (kopyaladığınız service_role anahtarı)
--    RESEND_API_KEY=re_... (Resend API anahtarınız)
-- 3. Starpie mesajlaşma sistemi (lib/actions/messages.ts), alıcı çevrimdışıyken
--    veya son 3 dakikadır aktif değilken otomatik olarak Resend üzerinden e-posta gönderir.
--
-- YÖNTEM B: Supabase Edge Function + Database Webhook
-- 1. Supabase CLI ile Edge Function'ı deploy edin:
--    supabase functions deploy send-message-email
-- 2. Fonksiyona Resend API anahtarını secret olarak tanımlayın:
--    supabase secrets set RESEND_API_KEY=re_your_api_key
-- 3. Supabase Dashboard > Database > Webhooks bölümüne gidin ve webhook ekleyin:
--    - Name: send_message_email_notification
--    - Table: public.messages
--    - Events: INSERT
--    - Type: Supabase Edge Function
--    - Edge Function: send-message-email
--    - HTTP Method: POST
-- =============================================
