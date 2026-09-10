'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getFriends } from '@/lib/actions/friends'
import { createGroup } from '@/lib/actions/groups'
import { useLanguage } from '@/components/LanguageProvider'
import type { Friend } from '@/lib/types'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  currentUserId: string
  onGroupCreated?: (groupId: string) => void
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  currentUserId,
  onGroupCreated,
}: CreateGroupModalProps) {
  const { t, lang } = useLanguage()
  const router = useRouter()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [searchFilter, setSearchFilter] = useState('')

  const [isLoadingFriends, setIsLoadingFriends] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch friends when modal opens
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setIsLoadingFriends(true)
    setErrorMsg(null)

    getFriends()
      .then(res => {
        if (isMounted) {
          setFriends(res)
          setIsLoadingFriends(false)
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Error fetching friends:', err)
          setIsLoadingFriends(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Reset state on close
  const handleClose = () => {
    if (isSubmitting) return
    setName('')
    setDescription('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setSelectedFriendIds([])
    setSearchFilter('')
    setErrorMsg(null)
    onClose()
  }

  // Handle Photo Selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg(lang === 'tr' ? 'Lütfen geçerli bir resim dosyası seçin.' : 'Please select an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(lang === 'tr' ? 'Fotoğraf boyutu 5 MB\'dan küçük olmalıdır.' : 'Image size must be less than 5 MB.')
      return
    }

    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setErrorMsg(null)
  }

  // Toggle Friend Selection
  const toggleFriend = (friendId: string) => {
    setSelectedFriendIds(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    )
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrorMsg(lang === 'tr' ? 'Lütfen bir grup adı girin.' : 'Please enter a group name.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      let avatarUrl: string | null = null

      // Upload group photo if selected
      if (photoFile) {
        const supabase = createClient()
        const ext = photoFile.name.split('.').pop() || 'jpg'
        const fileName = `${currentUserId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('group-photos')
          .upload(fileName, photoFile, { contentType: photoFile.type })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('group-photos').getPublicUrl(fileName)
          avatarUrl = urlData.publicUrl
        } else {
          console.warn('Group photo upload warning:', uploadError)
        }
      }

      const res = await createGroup({
        name: trimmedName,
        description: description.trim() || null,
        avatarUrl,
        memberUserIds: selectedFriendIds,
      })

      if (res.success && res.groupId) {
        handleClose()
        if (onGroupCreated) {
          onGroupCreated(res.groupId)
        } else {
          router.push(`/messages/group/${res.groupId}`)
        }
      } else {
        setErrorMsg(res.error || (lang === 'tr' ? 'Grup oluşturulamadı.' : 'Failed to create group.'))
        setIsSubmitting(false)
      }
    } catch (err: any) {
      console.error('Error in create group:', err)
      setErrorMsg(err.message || (lang === 'tr' ? 'Beklenmeyen bir hata oluştu.' : 'An error occurred.'))
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const filteredFriends = friends.filter(f =>
    (f.friend?.full_name || '').toLowerCase().includes(searchFilter.toLowerCase().trim())
  )

  return (
    <div className="group-modal-backdrop" onClick={handleClose}>
      {/* Container is directly the form to guarantee 100% flex height calculation */}
      <form
        onSubmit={handleSubmit}
        className="group-modal-container"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* 1. Fixed Header (Always pinned at top) */}
        <div className="group-modal-header">
          <div>
            <h3 className="group-modal-title">{t('groups.create_title')}</h3>
            <p className="group-modal-sub">{t('groups.create_sub')}</p>
          </div>
          <button
            type="button"
            className="group-modal-close-btn"
            onClick={handleClose}
            aria-label={t('nav.close')}
            disabled={isSubmitting}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 2. Scrollable Body (Takes available height, scrolls internally) */}
        <div className="group-modal-body">
          {errorMsg && <div className="group-modal-alert group-modal-alert--error">{errorMsg}</div>}

          {/* Group Photo & Name Row */}
          <div className="group-modal-photo-name-row">
            {/* Avatar Upload */}
            <div
              className="group-modal-photo-picker"
              onClick={() => fileInputRef.current?.click()}
              title={t('groups.photo_label')}
            >
              {photoPreview ? (
                <Image
                  src={photoPreview}
                  alt="Grup Fotoğrafı"
                  width={56}
                  height={56}
                  className="group-modal-photo-img"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className="group-modal-photo-placeholder">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>{lang === 'tr' ? 'Fotoğraf' : 'Photo'}</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
                disabled={isSubmitting}
              />
            </div>

            {/* Name Input */}
            <div className="group-modal-name-group">
              <label className="group-modal-label">
                {t('groups.name_label')} <span style={{ color: 'var(--pink-600)' }}>*</span>
              </label>
              <input
                type="text"
                className="group-modal-input"
                placeholder={t('groups.name_placeholder')}
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>

          {/* Description (Optional) */}
          <div className="group-modal-field">
            <label className="group-modal-label">{t('groups.desc_label')}</label>
            <textarea
              className="group-modal-textarea"
              placeholder={t('groups.desc_placeholder')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={isSubmitting}
            />
          </div>

          {/* Member Selection Section */}
          <div className="group-modal-section">
            <div className="group-modal-section-header">
              <label className="group-modal-label" style={{ marginBottom: 0 }}>
                {t('groups.select_friends')}
                <span className="group-modal-selected-badge">
                  {selectedFriendIds.length} {lang === 'tr' ? 'seçildi' : 'selected'}
                </span>
              </label>
            </div>

            {/* Selected Friends Horizontal Chips (Instagram / WhatsApp style) */}
            {selectedFriendIds.length > 0 && (
              <div className="group-modal-selected-chips">
                {selectedFriendIds.map(fid => {
                  const fr = friends.find(f => f.friend?.id === fid)?.friend
                  if (!fr) return null
                  return (
                    <div
                      key={fid}
                      className="group-modal-chip"
                      onClick={() => toggleFriend(fid)}
                      title={lang === 'tr' ? 'Çıkarmak için tıkla' : 'Click to remove'}
                    >
                      <span className="group-modal-chip__name">
                        {fr.full_name?.split(' ')[0] || 'Üye'}
                      </span>
                      <span className="group-modal-chip__remove">×</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Friend Search Input */}
            <div className="group-modal-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className="group-modal-search-input"
                placeholder={t('friends.search_placeholder')}
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Friends List Scroll Area (own self-contained scrolling list) */}
            <div className="group-modal-friends-list">
              {isLoadingFriends ? (
                <div className="group-modal-loading">{t('common.loading')}</div>
              ) : friends.length === 0 ? (
                <p className="group-modal-empty-hint">
                  {lang === 'tr'
                    ? 'Henüz arkadaşın yok. Grubu şimdi kurup daha sonra da arkadaş ekleyebilirsin.'
                    : 'No friends found. You can create the group now and invite later.'}
                </p>
              ) : filteredFriends.length === 0 ? (
                <p className="group-modal-empty-hint">{t('friends.search_empty')}</p>
              ) : (
                filteredFriends.map(({ friend }) => {
                  if (!friend) return null
                  const isSelected = selectedFriendIds.includes(friend.id)
                  const initials = friend.full_name
                    ? friend.full_name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : '?'

                  return (
                    <div
                      key={friend.id}
                      className={`group-friend-row ${isSelected ? 'group-friend-row--selected' : ''}`}
                      onClick={() => toggleFriend(friend.id)}
                    >
                      <div className="group-friend-row__avatar">
                        {friend.avatar_url ? (
                          <Image
                            src={friend.avatar_url}
                            alt={friend.full_name || 'Friend'}
                            width={32}
                            height={32}
                            style={{ objectFit: 'cover', borderRadius: '50%' }}
                          />
                        ) : (
                          <span className="group-friend-row__fallback">{initials}</span>
                        )}
                      </div>

                      <div className="group-friend-row__info">
                        <span className="group-friend-row__name">{friend.full_name || 'User'}</span>
                        {friend.profession && (
                          <span className="group-friend-row__sub">{friend.profession}</span>
                        )}
                      </div>

                      <div className={`group-checkbox ${isSelected ? 'group-checkbox--checked' : ''}`}>
                        {isSelected && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* 3. Pinned / Sticky Footer - GUARANTEED 100% VISIBLE AND CLICKABLE */}
        <div className="group-modal-footer">
          <button
            type="button"
            className="btn btn--secondary btn-modal-cancel"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="btn btn--primary btn-create-group-submit"
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-dots" style={{ marginRight: '6px' }}></span>
                {t('groups.creating')}
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                {t('groups.create_btn')}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
