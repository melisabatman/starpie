'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { createMemory, deleteMemory } from '@/lib/actions/space'
import PolaroidCard from '@/components/PolaroidCard'
import { useLanguage } from '@/components/LanguageProvider'
import type { Memory } from '@/lib/types'

interface PolaroidGalleryProps {
  spaceId: string
  currentUserId: string
  initialMemories: Memory[]
}

export default function PolaroidGallery({
  spaceId,
  currentUserId,
  initialMemories,
}: PolaroidGalleryProps) {
  const { t } = useLanguage()
  const [memories, setMemories] = useState<Memory[]>(initialMemories)

  // Wipe and sync memories whenever spaceId or initialMemories change
  useEffect(() => {
    setMemories(initialMemories)
  }, [spaceId, initialMemories])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [memoryDate, setMemoryDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!selected.type.startsWith('image/')) {
      setErrorMsg(t('common.error'))
      return
    }

    if (selected.size > 10 * 1024 * 1024) {
      setErrorMsg(t('feed.img_size_err'))
      return
    }

    setErrorMsg(null)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  const resetForm = () => {
    setFile(null)
    setPreviewUrl(null)
    setCaption('')
    setMemoryDate(new Date().toISOString().split('T')[0])
    setErrorMsg(null)
    setIsModalOpen(false)
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMsg(t('polaroid.select_photo'))
      return
    }

    setIsUploading(true)
    setErrorMsg(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `${spaceId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`

      // Upload to Supabase storage bucket 'couple-memories'
      const { error: uploadError } = await supabase.storage
        .from('couple-memories')
        .upload(fileName, file, { contentType: file.type })

      if (uploadError) {
        setErrorMsg('Fotoğraf yüklenemedi: ' + uploadError.message)
        setIsUploading(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('couple-memories').getPublicUrl(fileName)

      // Call server action to save record
      const result = await createMemory(
        spaceId,
        publicUrl,
        caption,
        memoryDate
      )

      if (result.success && result.memory) {
        setMemories(prev => [result.memory!, ...prev])
        resetForm()
      } else {
        setErrorMsg(result.error || 'Anı kaydedilemedi.')
      }
    } catch (err: any) {
      console.error('Error saving memory:', err)
      setErrorMsg('Beklenmeyen bir hata oluştu.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (memoryId: string) => {
    const result = await deleteMemory(memoryId)
    if (result.success) {
      setMemories(prev => prev.filter(m => m.id !== memoryId))
    }
  }

  return (
    <div className="polaroid-gallery-section">
      {/* Action Header */}
      <div className="polaroid-gallery-header" data-aos="fade-up">
        <div>
          <h2 className="polaroid-gallery-title">{t('polaroid.title')}</h2>
          <p className="polaroid-gallery-sub">
            {t('polaroid.sub')}
          </p>
        </div>

        <button
          type="button"
          id="add-memory-btn"
          className="btn btn--primary"
          onClick={() => setIsModalOpen(true)}
          style={{ width: 'auto', display: 'inline-flex', gap: '8px' }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {t('polaroid.add_btn')}
        </button>
      </div>

      {/* Polaroid Grid */}
      {memories.length === 0 ? (
        <div className="polaroid-empty">
          <div className="polaroid-empty__card">
            <div className="polaroid-tape" />
            <div className="polaroid-empty__photo">
              <span className="polaroid-empty__icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </span>
            </div>
            <p className="polaroid-caption" style={{ fontSize: '20px' }}>
              {t('polaroid.first_hang_prompt')}
            </p>
          </div>
          <h3 className="polaroid-empty__title">{t('polaroid.empty_title')}</h3>
          <p className="polaroid-empty__sub">
            {t('polaroid.empty_sub')}
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setIsModalOpen(true)}
            style={{ width: 'auto', display: 'inline-flex', marginTop: '12px' }}
          >
            {t('polaroid.first_upload_btn')}
          </button>
        </div>
      ) : (
        <div className="polaroid-grid">
          {memories.map(memory => (
            <PolaroidCard
              key={memory.id}
              memory={memory}
              currentUserId={currentUserId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Memory Modal */}
      {isModalOpen && (
        <div className="memory-modal-overlay" onClick={resetForm}>
          <div
            className="memory-modal-content"
            onClick={e => e.stopPropagation()}
          >
            <div className="memory-modal-header">
              <h3 className="memory-modal-title">{t('polaroid.modal_title')}</h3>
              <button
                type="button"
                className="memory-modal-close"
                onClick={resetForm}
                aria-label={t('nav.close')}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload} className="memory-modal-form">
              {/* Photo preview or picker */}
              <div
                className="memory-picker-box"
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <div className="memory-preview-wrapper">
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      fill
                      sizes="(max-width: 640px) 100vw, 350px"
                      unoptimized={previewUrl.startsWith('blob:')}
                      className="memory-preview-img"
                      style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />
                    <div className="memory-change-hint">
                      {t('polaroid.change_photo')}
                    </div>
                  </div>
                ) : (
                  <div className="memory-picker-empty">
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--pink-400)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p className="memory-picker-text">
                      {t('polaroid.click_to_choose')}
                    </p>
                    <span className="memory-picker-sub">
                      {t('polaroid.format_hint')}
                    </span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Caption */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label" htmlFor="memory-caption-input">
                  {t('polaroid.caption_label')}
                </label>
                <input
                  type="text"
                  id="memory-caption-input"
                  className="form-input"
                  placeholder={t('polaroid.caption_placeholder')}
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Date picker */}
              <div className="form-group">
                <label className="form-label" htmlFor="memory-date-input">
                  {t('polaroid.date_label')}
                </label>
                <input
                  type="date"
                  id="memory-date-input"
                  className="form-input"
                  value={memoryDate}
                  onChange={e => setMemoryDate(e.target.value)}
                />
              </div>

              {errorMsg && (
                <div className="form-error" style={{ margin: '8px 0' }}>
                  {errorMsg}
                </div>
              )}

              {/* Actions */}
              <div className="memory-modal-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={resetForm}
                  disabled={isUploading}
                  style={{ width: 'auto' }}
                >
                  {t('common.cancel')}
                </button>

                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!file || isUploading}
                  style={{ width: 'auto', minWidth: '130px' }}
                >
                  {isUploading ? (
                    <span className="spinner spinner--sm" />
                  ) : (
                    t('polaroid.hang_btn')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
