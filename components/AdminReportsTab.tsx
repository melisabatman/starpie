'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { getAdminReports, updateReportStatus } from '@/lib/actions/moderation'
import type { Report } from '@/lib/types'
import { useLanguage } from '@/components/LanguageProvider'

export default function AdminReportsTab() {
  const { lang } = useLanguage()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all')
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)

  const loadReports = async () => {
    setLoading(true)
    try {
      const data = await getAdminReports()
      setReports(data || [])
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  const handleUpdateStatus = (reportId: string, newStatus: 'resolved' | 'dismissed') => {
    setActionId(reportId)
    startTransition(async () => {
      const res = await updateReportStatus(reportId, newStatus)
      if (res.success) {
        setReports(prev =>
          prev.map(r => (r.id === reportId ? { ...r, status: newStatus } : r))
        )
      }
      setActionId(null)
    })
  }

  const filteredReports = reports.filter(r => {
    if (statusFilter === 'all') return true
    return r.status === statusFilter
  })

  const pendingCount = reports.filter(r => r.status === 'pending').length

  const reasonTranslations: Record<string, { tr: string; en: string }> = {
    spam: { tr: 'Spam / İstenmeyen', en: 'Spam' },
    harassment: { tr: 'Taciz / Rahatsız Edici', en: 'Harassment' },
    hate_speech: { tr: 'Nefret Söylemi', en: 'Hate Speech' },
    inappropriate: { tr: 'Uygunsuz İçerik', en: 'Inappropriate Content' },
    other: { tr: 'Diğer', en: 'Other' },
  }

  return (
    <div className="admin-reports-container" data-aos="fade-up">
      {/* Header & Filter Tabs */}
      <div className="admin-reports-header">
        <div>
          <h3 className="admin-reports-title">
            {lang === 'tr' ? 'Kullanıcı Şikayetleri & Moderasyon' : 'User Reports & Moderation'}
          </h3>
          <p className="admin-reports-sub">
            {lang === 'tr'
              ? `${pendingCount} bekleyen şikayet incelenmeyi bekliyor.`
              : `${pendingCount} pending reports waiting for review.`}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="admin-reports-filters">
          <button
            type="button"
            className={`admin-report-filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            {lang === 'tr' ? 'Tümü' : 'All'} ({reports.length})
          </button>
          <button
            type="button"
            className={`admin-report-filter-pill ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            {lang === 'tr' ? 'Bekleyen' : 'Pending'} ({pendingCount})
          </button>
          <button
            type="button"
            className={`admin-report-filter-pill ${statusFilter === 'resolved' ? 'active' : ''}`}
            onClick={() => setStatusFilter('resolved')}
          >
            {lang === 'tr' ? 'Çözülen' : 'Resolved'}
          </button>
          <button
            type="button"
            className={`admin-report-filter-pill ${statusFilter === 'dismissed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('dismissed')}
          >
            {lang === 'tr' ? 'Reddedilen' : 'Dismissed'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <span className="spinner spinner--sm" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="blog-card-box blog-empty-state" style={{ marginTop: 20 }}>
          <div className="blog-empty-icon">✓</div>
          <h4 className="blog-empty-title">
            {lang === 'tr' ? 'Şikayet Bulunmuyor' : 'No Reports Found'}
          </h4>
          <p className="blog-empty-sub">
            {lang === 'tr'
              ? 'Seçilen filtrelere uygun herhangi bir şikayet bulunamadı.'
              : 'There are no reports matching the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="admin-reports-list">
          {filteredReports.map(report => {
            const isActing = isPending && actionId === report.id
            const reasonObj = reasonTranslations[report.reason] || { tr: report.reason, en: report.reason }

            return (
              <div key={report.id} className="admin-report-card">
                <div className="admin-report-card-top">
                  <div className="admin-report-badges">
                    <span className={`admin-report-status-badge status--${report.status}`}>
                      {report.status === 'pending'
                        ? lang === 'tr' ? 'Beklemede' : 'Pending'
                        : report.status === 'resolved'
                        ? lang === 'tr' ? 'Çözüldü' : 'Resolved'
                        : lang === 'tr' ? 'Reddedildi' : 'Dismissed'}
                    </span>

                    <span className="admin-report-type-badge">
                      {report.target_type === 'post'
                        ? lang === 'tr' ? 'Gönderi' : 'Post'
                        : lang === 'tr' ? 'Kullanıcı' : 'User'}
                    </span>

                    <span className="admin-report-reason-badge">
                      {reasonObj[lang === 'tr' ? 'tr' : 'en']}
                    </span>
                  </div>

                  <time className="admin-report-date">
                    {new Date(report.created_at).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>

                {/* People involved */}
                <div className="admin-report-people">
                  <div className="admin-report-person">
                    <span className="admin-report-person-label">
                      {lang === 'tr' ? 'Şikayet Eden:' : 'Reporter:'}
                    </span>
                    <Link
                      href={`/profile/${report.reporter_id}`}
                      className="admin-report-person-name"
                    >
                      {report.reporter?.full_name || report.reporter_id}
                    </Link>
                  </div>

                  {report.reported_user_id && (
                    <div className="admin-report-person">
                      <span className="admin-report-person-label">
                        {lang === 'tr' ? 'Şikayet Edilen:' : 'Reported User:'}
                      </span>
                      <Link
                        href={`/profile/${report.reported_user_id}`}
                        className="admin-report-person-name"
                      >
                        {report.reported_user?.full_name || report.reported_user_id}
                      </Link>
                    </div>
                  )}
                </div>

                {/* Details */}
                {report.details && (
                  <div className="admin-report-details">
                    <strong>{lang === 'tr' ? 'Açıklama:' : 'Details:'}</strong> {report.details}
                  </div>
                )}

                {/* Target link */}
                <div className="admin-report-target-info">
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                    Hedef ID: <code>{report.target_id}</code>
                  </span>
                </div>

                {/* Actions */}
                {report.status === 'pending' && (
                  <div className="admin-report-actions">
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ fontSize: 12, padding: '6px 16px', width: 'auto' }}
                      disabled={isActing}
                      onClick={() => handleUpdateStatus(report.id, 'resolved')}
                    >
                      {isActing ? '...' : lang === 'tr' ? '✓ Çözüldü Olarak İşaretle' : '✓ Mark Resolved'}
                    </button>

                    <button
                      type="button"
                      className="btn btn--secondary"
                      style={{ fontSize: 12, padding: '6px 16px', width: 'auto' }}
                      disabled={isActing}
                      onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                    >
                      {isActing ? '...' : lang === 'tr' ? '✕ Reddet' : '✕ Dismiss'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
