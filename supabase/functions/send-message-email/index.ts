// ────────────────────────────────────────────────────────────
// Starpie — Supabase Edge Function: send-message-email
// Triggered on new message insert when receiver is offline
// ────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    // Supabase Database Webhooks send payload.record; direct calls might pass the message object
    const record = payload.record || payload

    if (!record || !record.sender_id || !record.receiver_id) {
      return new Response(
        JSON.stringify({ error: 'Geçersiz mesaj verisi: sender_id ve receiver_id gereklidir.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { sender_id, receiver_id, content, message_type } = record

    // 1. Check API Keys
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.warn('[send-message-email] RESEND_API_KEY tanımlanmamış, e-posta gönderimi atlandı.')
      return new Response(
        JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY is not set' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://starpie.netlify.app'
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Starpie <onboarding@resend.dev>'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. Query Receiver's Profile: Check notification preferences and last_seen_at
    const { data: receiverProfile, error: rProfileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email_notifications_enabled, last_seen_at')
      .eq('id', receiver_id)
      .single()

    if (rProfileErr || !receiverProfile) {
      return new Response(
        JSON.stringify({ error: 'Alıcı profili bulunamadı.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // A) If user disabled email notifications, skip
    if (receiverProfile.email_notifications_enabled === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'notifications_disabled_by_user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // B) Check if receiver is online (active within the last 3 minutes)
    if (receiverProfile.last_seen_at) {
      const lastSeen = new Date(receiverProfile.last_seen_at).getTime()
      const now = Date.now()
      const diffMs = now - lastSeen
      const threeMinutesMs = 3 * 60 * 1000

      if (diffMs < threeMinutesMs) {
        return new Response(
          JSON.stringify({ skipped: true, reason: 'user_is_currently_online' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 3. Query Sender Profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', sender_id)
      .single()

    const senderName = senderProfile?.full_name ?? 'Bir arkadaşın'
    const receiverName = receiverProfile.full_name?.split(' ')[0] ?? 'Kullanıcı'

    // 4. Query Receiver Email from auth.users
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(receiver_id)
    if (authErr || !authUser?.user?.email) {
      return new Response(
        JSON.stringify({ error: 'Alıcının e-posta adresi bulunamadı.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const receiverEmail = authUser.user.email

    // 5. Build Email Content
    const messagePreview = message_type === 'audio'
      ? '🎤 1 yeni sesli mesaj'
      : (content && content.trim().length > 140 ? content.trim().slice(0, 140) + '...' : content?.trim() || 'Yeni bir mesaj')

    const chatUrl = `${appUrl}/messages/${sender_id}`
    const settingsUrl = `${appUrl}/settings`

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fdf2f8; margin: 0; padding: 24px; color: #1f2937; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px 28px; box-shadow: 0 10px 30px rgba(236, 72, 153, 0.12); border: 1px solid #fbcfe8; }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { font-size: 26px; font-weight: 800; color: #db2777; letter-spacing: -0.5px; text-decoration: none; }
          .badge { display: inline-block; background: #fce7f3; color: #be185d; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-top: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #111827; margin: 16px 0 8px; text-align: center; }
          .sub { font-size: 14.5px; color: #6b7280; text-align: center; margin-bottom: 24px; line-height: 1.5; }
          .bubble-box { background: #fff5fb; border-left: 4px solid #ec4899; border-radius: 12px; padding: 16px 18px; margin-bottom: 28px; }
          .sender-label { font-size: 13px; font-weight: 700; color: #be185d; margin-bottom: 6px; }
          .msg-text { font-size: 15px; color: #374151; line-height: 1.6; margin: 0; }
          .btn-container { text-align: center; margin-bottom: 28px; }
          .btn { display: inline-block; background: linear-gradient(135deg, #db2777, #ec4899); color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 13px 32px; border-radius: 9999px; box-shadow: 0 4px 14px rgba(219, 39, 119, 0.35); }
          .footer { border-top: 1px solid #f3f4f6; padding-top: 20px; text-align: center; font-size: 12px; color: #9ca3af; line-height: 1.5; }
          .footer a { color: #db2777; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <a href="${appUrl}" class="logo">🌸 Starpie</a>
            <br/>
            <span class="badge">💬 Yeni Mesaj Bildirimi</span>
          </div>

          <h1 class="title">Merhaba ${receiverName}!</h1>
          <p class="sub">
            Sen çevrimdışıyken <strong>${senderName}</strong> sana Starpie üzerinden yeni bir mesaj gönderdi.
          </p>

          <div class="bubble-box">
            <div class="sender-label">💌 ${senderName}:</div>
            <p class="msg-text">${messagePreview}</p>
          </div>

          <div class="btn-container">
            <a href="${chatUrl}" class="btn">Mesajı Gör ve Yanıtla ✨</a>
          </div>

          <div class="footer">
            Bu e-posta, çevrimdışı olduğunuzda önemli mesajları kaçırmamanız için gönderilmiştir.<br/>
            E-posta bildirimlerini kapatmak isterseniz <a href="${settingsUrl}">Ayarlar sayfasından</a> dilediğiniz an kapatabilirsiniz.
          </div>
        </div>
      </body>
      </html>
    `

    // 6. Send Email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [receiverEmail],
        subject: `🌸 ${senderName} sana bir mesaj gönderdi!`,
        html: htmlBody,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('[send-message-email] Resend API hatası:', resendData)
      return new Response(
        JSON.stringify({ error: 'Resend API e-posta gönderemedi', details: resendData }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[send-message-email] E-posta başarıyla iletildi:', resendData.id)
    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[send-message-email] Beklenmeyen hata:', error)
    return new Response(
      JSON.stringify({ error }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
