'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/LanguageProvider'

export default function AuthForm() {
  const { t } = useLanguage()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'register') {
        const cleanUsername = username.trim().toLowerCase().replace(/^@/, '')
        if (!cleanUsername) {
          setError(t('auth.username_required') || 'Lütfen bir kullanıcı adı girin.')
          setLoading(false)
          return
        }
        if (cleanUsername.length < 3 || cleanUsername.length > 30 || !/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
          setError(t('auth.username_invalid'))
          setLoading(false)
          return
        }

        // Check if username already taken in profiles table
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', cleanUsername)
          .maybeSingle()

        if (existingUser) {
          setError(t('auth.username_taken'))
          setLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: cleanUsername,
            },
          },
        })
        if (error) throw error

        if (data.user) {
          // Immediately upsert username to profiles
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: cleanUsername,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' })

          if (!data.user.email_confirmed_at && !data.session) {
            setSuccess(t('auth.success_register'))
            setTimeout(() => {
              window.location.href = '/feed'
            }, 600)
          } else {
            window.location.href = '/profile/setup'
          }
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // Instant direct transition to feed page
        window.location.href = '/feed'
        return
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('common.error')
      if (message.includes('Invalid login credentials')) {
        setError(t('auth.err_credentials'))
      } else if (message.includes('User already registered')) {
        setError(t('auth.err_already_reg'))
      } else if (message.includes('Password should be at least')) {
        setError(t('auth.err_pass_length'))
      } else if (message.includes('profiles_username_key') || message.includes('unique') || message.includes('duplicate')) {
        setError(t('auth.username_taken'))
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" data-aos="fade-up">
      {/* Brand */}
      <div className="brand">
        <div className="brand__logo">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
          </svg>
        </div>
        <h1 className="brand__name">{t('brand.name')}</h1>
        <p className="brand__tagline">{t('auth.tagline')}</p>
      </div>

      {/* Tab Toggle */}
      <div className="tab-group" role="tablist">
        <button
          id="tab-login"
          role="tab"
          aria-selected={mode === 'login'}
          className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
          onClick={() => { setMode('login'); setUsername(''); setError(null); setSuccess(null) }}
        >
          {t('auth.login_tab')}
        </button>
        <button
          id="tab-register"
          role="tab"
          aria-selected={mode === 'register'}
          className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
          onClick={() => { setMode('register'); setError(null); setSuccess(null) }}
        >
          {t('auth.register_tab')}
        </button>
      </div>

      {/* Form */}
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert--success" role="alert">
            {success}
          </div>
        )}

        {mode === 'register' && (
          <div className="form-group">
            <label className="form-label" htmlFor="username">{t('auth.username')}</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{
                position: 'absolute',
                left: '14px',
                color: 'var(--pink-400)',
                fontWeight: 700,
                fontSize: '15px',
                pointerEvents: 'none',
                userSelect: 'none'
              }}>@</span>
              <input
                id="username"
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px' }}
                placeholder="kullaniciadi"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                required
                autoComplete="username"
                minLength={3}
                maxLength={30}
              />
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--gray-400)', marginTop: '4px', marginInlineStart: '2px' }}>
              {t('auth.username_hint') || 'En az 3 karakter, harf, rakam ve alt çizgi'}
            </p>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="email">{t('auth.email')}</label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder={t('auth.email_placeholder')}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">{t('auth.password')}</label>
          <input
            id="password"
            type="password"
            className="form-input"
            placeholder={mode === 'register' ? t('auth.password_placeholder') : '••••••••'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={6}
          />
        </div>

        <button
          id="auth-submit-btn"
          type="submit"
          className="btn btn--primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner" />
              {mode === 'login' ? t('auth.logging_in') : t('auth.registering')}
            </>
          ) : (
            mode === 'login' ? `${t('auth.login_btn')} →` : `${t('auth.register_btn')} →`
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--gray-400)' }}>
        {mode === 'login'
          ? <>{t('auth.no_account')} <button className="btn btn--ghost" style={{ padding: '0', fontSize: '13px' }} onClick={() => { setMode('register'); setError(null); setSuccess(null) }}>{t('auth.register_tab')}</button></>
          : <>{t('auth.have_account')} <button className="btn btn--ghost" style={{ padding: '0', fontSize: '13px' }} onClick={() => { setMode('login'); setUsername(''); setError(null); setSuccess(null) }}>{t('auth.login_tab')}</button></>
        }
      </p>
    </div>
  )
}
