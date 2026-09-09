'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { reportContent, blockUser } from '@/lib/actions/moderation'
import { useLanguage } from '@/components/LanguageProvider'

interface ModerationMenuProps {
  targetType: 'post' | 'user'
  targetId: string
  reportedUserId: string
  targetName?: string
  className?: string
  onBlocked?: () => void
}

type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'inappropriate' | 'other'

export default function ModerationMenu({
  targetType,
  targetId,
  reportedUserId,
  targetName,
  className = '',
  onBlocked,
}: ModerationMenuProps) {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)

  // Report form state
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [isSubmitting, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)
    startTransition(async () => {
      const res = await reportContent({
        targetType,
        targetId,
        reportedUserId,
        reason,
        details: details.trim() || undefined,
      })

      if (res.success) {
        setFeedback({
          type: 'success',
          message:
            lang === 'tr'
              ? 'Şikayetiniz moderasyon ekibine iletildi. Teşekkür ederiz.'
              : 'Your report has been submitted to moderators. Thank you.',
        })
        setTimeout(() => {
          setShowReportModal(false)
          setFeedback(null)
          setDetails('')
        }, 1500)
      } else {
        setFeedback({
          type: 'error',
          message: res.error || (lang === 'tr' ? 'Şikayet gönderilemedi.' : 'Failed to submit report.'),
        })
      }
    })
  }

  const handleBlockConfirm = () => {
    setFeedback(null)
    startTransition(async () => {
      const res = await blockUser(reportedUserId)
      if (res.success) {
        setFeedback({
          type: 'success',
          message: lang === 'tr' ? 'Kullanıcı başarıyla engellendi.' : 'User blocked successfully.',
        })
        setTimeout(() => {
          setShowBlockModal(false)
          if (onBlocked) {
            onBlocked()
          } else {
            router.refresh()
          }
        }, 1200)
      } else {
        setFeedback({
          type: 'error',
          message: res.error || (lang === 'tr' ? 'Engelleme başarısız oldu.' : 'Failed to block user.'),
        })
      }
    })
  }

  const reasonLabels: Record<ReportReason, { tr: string; en: string }> = {
    spam: { tr: 'Spam / İstenmeyen İçerik', en: 'Spam / Unwanted Content' },
    harassment: { tr: 'Taciz / Rahatsız Edici Davranış', en: 'Harassment / Abusive Behavior' },
    hate_speech: { tr: 'Nefret Söylemi / Şiddet', en: 'Hate Speech / Violence' },
    inappropriate: { tr: 'Uygunsuz İçerik / Müstehcenlik', en: 'Inappropriate Content' },
    other: { tr: 'Diğer', en: 'Other' },
  }

  return (
    <div className={`moderation-menu-container ${className}`} ref={menuRef}>
      <button
        type="button"
        className="moderation-trigger-btn"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={lang === 'tr' ? 'Daha fazla seçenek' : 'More options'}
        title={lang === 'tr' ? 'Daha fazla seçenek' : 'More options'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="moderation-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="moderation-item"
            onClick={() => {
              setIsOpen(false)
              setShowReportModal(true)
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            <span>{lang === 'tr' ? 'Şikayet Et' : 'Report'}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="moderation-item moderation-item--danger"
            onClick={() => {
              setIsOpen(false)
              setShowBlockModal(true)
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <span>{lang === 'tr' ? 'Kullanıcıyı Engelle' : 'Block User'}</span>
          </button>
        </div>
      )}

      {/* ── Report Modal ── */}
      {showReportModal && (
        <div className="moderation-modal-overlay" onClick={() => !isSubmitting && setShowReportModal(false)}>
          <div className="moderation-modal-card" onClick={e => e.stopPropagation()}>
            <div className="moderation-modal-header">
              <div className="moderation-modal-icon">🚩</div>
              <div>
                <h3 className="moderation-modal-title">
                  {lang === 'tr' ? 'Şikayet Gönder' : 'Submit Report'}
                </h3>
                <p className="moderation-modal-sub">
                  {lang === 'tr'
                    ? 'Lütfen bu içeriğin veya kullanıcının neden topluluk kurallarına aykırı olduğunu belirtin.'
                    : 'Please specify why this content or user violates community guidelines.'}
                </p>
              </div>
            </div>

            {feedback && (
              <div className={`alert ${feedback.type === 'success' ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 14 }}>
                {feedback.message}
              </div>
            )}

            <form onSubmit={handleReportSubmit}>
              <div className="moderation-form-group">
                <label className="moderation-label">
                  {lang === 'tr' ? 'Şikayet Sebebi' : 'Reason'}
                </label>
                <div className="moderation-radio-group">
                  {(Object.keys(reasonLabels) as ReportReason[]).map(r => (
                    <label key={r} className={`moderation-radio-item ${reason === r ? 'moderation-radio-item--active' : ''}`}>
                      <input
                        type="radio"
                        name="reportReason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                      />
                      <span>{reasonLabels[r][lang === 'tr' ? 'tr' : 'en']}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="moderation-form-group">
                <label className="moderation-label">
                  {lang === 'tr' ? 'Açıklama (İsteğe Bağlı)' : 'Details (Optional)'}
                </label>
                <textarea
                  className="input moderation-textarea"
                  rows={3}
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder={lang === 'tr' ? 'Olay hakkında ek bilgi verebilirsiniz...' : 'Provide additional details...'}
                  maxLength={500}
                />
              </div>

              <div className="moderation-modal-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={isSubmitting}
                  onClick={() => setShowReportModal(false)}
                >
                  {lang === 'tr' ? 'Vazgeç' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (lang === 'tr' ? 'Gönderiliyor...' : 'Submitting...') : (lang === 'tr' ? 'Şikayeti Gönder' : 'Submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Block Modal ── */}
      {showBlockModal && (
        <div className="moderation-modal-overlay" onClick={() => !isSubmitting && setShowBlockModal(false)}>
          <div className="moderation-modal-card" onClick={e => e.stopPropagation()}>
            <div className="moderation-modal-header">
              <div className="moderation-modal-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                🚫
              </div>
              <div>
                <h3 className="moderation-modal-title">
                  {lang === 'tr' ? 'Kullanıcıyı Engelle' : 'Block User'}
                </h3>
                <p className="moderation-modal-sub">
                  {lang === 'tr'
                    ? `${targetName ? `"${targetName}"` : 'Bu kullanıcı'} engellensin mi?`
                    : `Block ${targetName ? `"${targetName}"` : 'this user'}?`}
                </p>
              </div>
            </div>

            <div className="moderation-block-warning">
              <p>
                {lang === 'tr'
                  ? 'Engellediğinizde birbirinizin gönderilerini, profilini ve anılarını göremeyecek; mesajlaşamayacak ve arkadaş olamayacaksınız.'
                  : 'Once blocked, you will no longer see each other’s posts, profiles, or memories, nor be able to chat or add as friend.'}
              </p>
            </div>

            {feedback && (
              <div className={`alert ${feedback.type === 'success' ? 'alert--success' : 'alert--error'}`} style={{ marginBottom: 14 }}>
                {feedback.message}
              </div>
            )}

            <div className="moderation-modal-actions">
              <button
                type="button"
                className="btn btn--secondary"
                disabled={isSubmitting}
                onClick={() => setShowBlockModal(false)}
              >
                {lang === 'tr' ? 'Vazgeç' : 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                disabled={isSubmitting}
                onClick={handleBlockConfirm}
              >
                {isSubmitting ? (lang === 'tr' ? 'Engelleniyor...' : 'Blocking...') : (lang === 'tr' ? 'Evet, Engelle' : 'Yes, Block')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
