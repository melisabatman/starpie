import { createClient } from '@/lib/supabase/server'
import type { Message } from '@/lib/types'

// ────────────────────────────────────────────────────────────
// Send Email Notification if receiver is offline and enabled
// ────────────────────────────────────────────────────────────

export async function sendEmailNotificationIfOffline(message: Message) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY ortam değişkeni tanımlı değil. E-posta bildirimi gönderilmedi.')
    return
  }

  try {
    const supabase = await createClient()

    // 1. Check receiver profile
    const { data: receiverProfile, error: rProfileErr } = await supabase
      .from('profiles')
      .select('id, full_name, email_notifications_enabled, last_seen_at')
      .eq('id', message.receiver_id)
      .single()

    if (rProfileErr || !receiverProfile) {
      console.warn('[Email] Alıcı profili bulunamadı:', message.receiver_id, rProfileErr)
      return
    }

    // If receiver muted email notifications, skip
    if (receiverProfile.email_notifications_enabled === false) {
      console.info('[Email] Alıcı e-posta bildirimlerini kapatmış, gönderim atlandı:', receiverProfile.id)
      return
    }

    // If receiver was active in the last 3 minutes, they are online -> skip email
    if (receiverProfile.last_seen_at) {
      const lastSeen = new Date(receiverProfile.last_seen_at).getTime()
      const now = Date.now()
      const diffMs = now - lastSeen
      const threeMinutesMs = 3 * 60 * 1000

      if (diffMs < threeMinutesMs) {
        console.info('[Email] Alıcı son 3 dakika içinde aktif (çevrimiçi), e-posta bildirimi atlandı.')
        return
      }
    }

    // 2. Fetch sender profile
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', message.sender_id)
      .single()

    const senderName = senderProfile?.full_name ?? 'Bir arkadaşın'
    const receiverName = receiverProfile.full_name?.split(' ')[0] ?? 'Kullanıcı'

    // 3. Fetch receiver email from auth.users via admin client or auth check
    let receiverEmail: string | null = null
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (serviceKey && supabaseUrl) {
      const { createClient: createSupabaseAdmin } = await import('@supabase/supabase-js')
      const adminClient = createSupabaseAdmin(supabaseUrl, serviceKey)
      const { data: authUser, error: authErr } = await adminClient.auth.admin.getUserById(message.receiver_id)
      if (authErr) {
        console.error('[Email] Supabase admin getUserById hatası:', authErr.message)
      }
      receiverEmail = authUser?.user?.email ?? null
    } else {
      console.warn('[Email] SUPABASE_SERVICE_ROLE_KEY ortam değişkeni eksik! auth.users tablosundan alıcının e-posta adresi sorgulanamadı. Lütfen .env.local ve sunucu ortamına SUPABASE_SERVICE_ROLE_KEY ekleyin.')
    }

    if (!receiverEmail) {
      console.warn('[Email] Alıcının e-posta adresi bulunamadığı için e-posta gönderilemedi.')
      return
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://starpie.netlify.app'
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Starpie <onboarding@resend.dev>'

    const messagePreview = message.message_type === 'audio'
      ? '1 yeni sesli mesaj'
      : (message.content && message.content.length > 140
          ? message.content.slice(0, 140) + '...'
          : message.content || 'Yeni bir mesaj')

    const chatUrl = `${appUrl}/messages/${message.sender_id}`
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
            <a href="${appUrl}" class="logo">Starpie</a>
            <br/>
            <span class="badge">Yeni Mesaj Bildirimi</span>
          </div>

          <h1 class="title">Merhaba ${receiverName}!</h1>
          <p class="sub">
            Sen çevrimdışıyken <strong>${senderName}</strong> sana Starpie üzerinden yeni bir mesaj gönderdi.
          </p>

          <div class="bubble-box">
            <div class="sender-label">${senderName}:</div>
            <p class="msg-text">${messagePreview}</p>
          </div>

          <div class="btn-container">
            <a href="${chatUrl}" class="btn">Mesajı Gör ve Yanıtla</a>
          </div>

          <div class="footer">
            Bu e-posta, çevrimdışı olduğunuzda önemli mesajları kaçırmamanız için gönderilmiştir.<br/>
            E-posta bildirimlerini kapatmak isterseniz <a href="${settingsUrl}">Ayarlar sayfasından</a> dilediğiniz an kapatabilirsiniz.
          </div>
        </div>
      </body>
      </html>
    `

    console.info(`[Email] Resend API üzerinden ${receiverEmail} adresine bildirim gönderiliyor...`)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [receiverEmail],
        subject: `${senderName} sana bir mesaj gönderdi`,
        html: htmlBody,
      }),
    })

    const resData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('[Email] Resend API e-posta gönderemedi:', resData)
    } else {
      console.info('[Email] E-posta bildirimi başarıyla iletildi. Resend ID:', resData.id)
    }
  } catch (err) {
    console.error('[sendEmailNotificationIfOffline] Beklenmeyen hata:', err)
  }
}
