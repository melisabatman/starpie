'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'

interface Props {
  userId: string
  existingProfile?: {
    full_name?: string | null
    profession?: string | null
    bio?: string | null
    avatar_url?: string | null
    email_notifications_enabled?: boolean
  }
}

export default function ProfileSetupForm({ userId, existingProfile }: Props) {
  const { t, lang } = useLanguage()
  const [fullName, setFullName] = useState(existingProfile?.full_name ?? '')
  const [profession, setProfession] = useState(existingProfile?.profession ?? '')
  const [bio, setBio] = useState(existingProfile?.bio ?? '')
  const [emailNotifications, setEmailNotifications] = useState(
    existingProfile?.email_notifications_enabled ?? true
  )
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    existingProfile?.avatar_url ?? null
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError(t('profile.avatar_size_err'))
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError(t('profile.enter_name_err'))
      return
    }

    setLoading(true)

    try {
      let avatarUrl = existingProfile?.avatar_url ?? null

      // Upload avatar if a new file was selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const filePath = `${userId}/avatar.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true })

        if (uploadError) {
          throw new Error(`Fotoğraf yüklenemedi: ${uploadError.message}`)
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        avatarUrl = publicUrlData.publicUrl
      }

      // Upsert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          full_name: fullName.trim(),
          profession: profession.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          email_notifications_enabled: emailNotifications,
          updated_at: new Date().toISOString(),
        })

      if (profileError) throw profileError

      router.push(`/profile/${userId}`)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.error')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card card--wide">
      <div className="setup-header">
        <span className="setup-header__step">{t('profile.setup_step')}</span>
        <h1 className="setup-header__title">{t('profile.intro_title')}</h1>
        <p className="setup-header__sub">{t('profile.intro_sub')}</p>
      </div>

      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        {/* Avatar Upload */}
        <div className="avatar-upload">
          <div
            className="avatar-preview"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            id="avatar-upload-btn"
            aria-label={t('profile.add_photo')}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            {avatarPreview ? (
              <>
                <Image
                  src={avatarPreview}
                  alt={t('profile.add_photo')}
                  fill
                  sizes="120px"
                  style={{ objectFit: 'cover' }}
                  unoptimized={avatarPreview.startsWith('blob:')}
                />
                <div className="avatar-overlay">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </>
            ) : (
              <div className="avatar-preview__placeholder">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{t('profile.add_photo')}</span>
              </div>
            )}
          </div>
          <span className="avatar-upload-hint">{t('profile.avatar_hint')}</span>
          <input
            ref={fileInputRef}
            id="avatar-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="full-name">
            {t('profile.full_name')} <span style={{ color: 'var(--pink-500)' }}>*</span>
          </label>
          <input
            id="full-name"
            type="text"
            className="form-input"
            placeholder={lang === 'tr' ? 'Ayşe Yıldız' : 'Jane Doe'}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
            maxLength={80}
          />
        </div>

        {/* Profession */}
        <div className="form-group">
          <label className="form-label" htmlFor="profession">{t('profile.profession')}</label>
          <input
            id="profession"
            type="text"
            className="form-input"
            placeholder={t('profile.profession_placeholder')}
            value={profession}
            onChange={e => setProfession(e.target.value)}
            maxLength={80}
          />
        </div>

        {/* Bio */}
        <div className="form-group">
          <label className="form-label" htmlFor="bio">{t('profile.bio')}</label>
          <textarea
            id="bio"
            className="form-textarea"
            placeholder={t('profile.bio_placeholder')}
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <span style={{ fontSize: '12px', color: 'var(--gray-400)', textAlign: 'right' }}>
            {bio.length}/500
          </span>
        </div>

        {/* Email Notifications Toggle */}
        <div style={{ margin: '20px 0 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(244, 114, 182, 0.28)',
              background: 'rgba(255, 255, 255, 0.85)',
              boxShadow: '0 2px 8px rgba(236, 72, 153, 0.05)',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{ fontSize: '16px' }}>🔔</span>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--gray-800)' }}>
                  {t('settings.email_notifications_label')}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--gray-500)', margin: 0, lineHeight: 1.35 }}>
                {t('settings.email_notifications_sub')}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={emailNotifications}
              onClick={() => setEmailNotifications(!emailNotifications)}
              style={{
                width: 48,
                height: 28,
                borderRadius: 9999,
                background: emailNotifications ? 'linear-gradient(135deg, var(--pink-600), var(--pink-500))' : '#d1d5db',
                border: 'none',
                padding: 3,
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.25s ease',
                outline: 'none',
                flexShrink: 0,
                boxShadow: emailNotifications ? '0 2px 8px rgba(219, 39, 119, 0.3)' : 'none',
              }}
              title={emailNotifications ? t('settings.notifications_enabled') : t('settings.notifications_disabled')}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transform: emailNotifications ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </button>
          </div>
        </div>

        <button
          id="profile-save-btn"
          type="submit"
          className="btn btn--primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" />
              {t('profile.saving_profile')}
            </>
          ) : (
            t('profile.save_profile')
          )}
        </button>
      </form>
    </div>
  )
}
