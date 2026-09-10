'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getFriends } from '@/lib/actions/friends'
import {
  updateGroupInfo,
  addGroupMembers,
  removeGroupMember,
  setMemberRole,
  deleteGroup,
} from '@/lib/actions/groups'
import { useLanguage } from '@/components/LanguageProvider'
import type { Group, GroupMember, GroupRole, Friend } from '@/lib/types'

interface GroupInfoModalProps {
  isOpen: boolean
  onClose: () => void
  group: Group
  members: GroupMember[]
  currentUserRole: GroupRole
  currentUserId: string
  onGroupUpdated: (updatedGroup: Partial<Group>, updatedMembers?: GroupMember[]) => void
}

export default function GroupInfoModal({
  isOpen,
  onClose,
  group,
  members,
  currentUserRole,
  currentUserId,
  onGroupUpdated,
}: GroupInfoModalProps) {
  const { t, lang } = useLanguage()
  const router = useRouter()

  const isAdmin = currentUserRole === 'admin'

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [editDesc, setEditDesc] = useState(group.description || '')
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(group.avatar_url)

  // Add Member State
  const [isAddingMembers, setIsAddingMembers] = useState(false)
  const [availableFriends, setAvailableFriends] = useState<Friend[]>([])
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [friendSearch, setFriendSearch] = useState('')
  const [isLoadingFriends, setIsLoadingFriends] = useState(false)

  // Action status
  const [isBusy, setIsBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setEditName(group.name)
      setEditDesc(group.description || '')
      setEditPhotoPreview(group.avatar_url)
      setEditPhotoFile(null)
      setIsEditing(false)
      setIsAddingMembers(false)
      setErrorMsg(null)
      setSuccessMsg(null)
    }
  }, [isOpen, group])

  // Fetch friends who are not already in the group
  const handleOpenAddMembers = async () => {
    setIsAddingMembers(true)
    setIsLoadingFriends(true)
    setErrorMsg(null)
    setSelectedFriendIds([])

    try {
      const friends = await getFriends()
      const existingUserIds = new Set(members.map(m => m.user_id))
      const notInGroup = friends.filter(f => f.friend && !existingUserIds.has(f.friend.id))
      setAvailableFriends(notInGroup)
    } catch (err: any) {
      console.error('Error fetching friends to add:', err)
      setErrorMsg(err.message || 'Arkadaşlar yüklenemedi.')
    } finally {
      setIsLoadingFriends(false)
    }
  }

  // Handle Photo Picker
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

    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
  }

  // Save Group Info Edit
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return

    const trimmed = editName.trim()
    if (!trimmed) {
      setErrorMsg(lang === 'tr' ? 'Grup ismi boş olamaz.' : 'Group name cannot be empty.')
      return
    }

    setIsBusy(true)
    setErrorMsg(null)

    try {
      let avatarUrl = group.avatar_url

      if (editPhotoFile) {
        const supabase = createClient()
        const ext = editPhotoFile.name.split('.').pop() || 'jpg'
        const fileName = `${currentUserId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('group-photos')
          .upload(fileName, editPhotoFile, { contentType: editPhotoFile.type })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('group-photos').getPublicUrl(fileName)
          avatarUrl = urlData.publicUrl
        }
      }

      const res = await updateGroupInfo(group.id, {
        name: trimmed,
        description: editDesc.trim() || null,
        avatarUrl,
      })

      if (res.success) {
        onGroupUpdated({
          name: trimmed,
          description: editDesc.trim() || null,
          avatar_url: avatarUrl,
        })
        setIsEditing(false)
        setSuccessMsg(lang === 'tr' ? 'Grup bilgileri güncellendi.' : 'Group info updated.')
      } else {
        setErrorMsg(res.error || 'Güncellenemedi.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir hata oluştu.')
    } finally {
      setIsBusy(false)
    }
  }

  // Add Selected Friends to Group
  const handleConfirmAddMembers = async () => {
    if (selectedFriendIds.length === 0 || !isAdmin) return

    setIsBusy(true)
    setErrorMsg(null)

    try {
      const res = await addGroupMembers(group.id, selectedFriendIds)
      if (res.success) {
        // Construct new member entries
        const newMembersToAdd: GroupMember[] = selectedFriendIds.map(fid => {
          const fr = availableFriends.find(f => f.friend?.id === fid)?.friend
          return {
            id: `temp-${fid}-${Date.now()}`,
            group_id: group.id,
            user_id: fid,
            role: 'member',
            joined_at: new Date().toISOString(),
            profile: fr || null,
          }
        })
        onGroupUpdated({}, [...members, ...newMembersToAdd])
        setIsAddingMembers(false)
        setSelectedFriendIds([])
        setSuccessMsg(lang === 'tr' ? 'Yeni üyeler eklendi!' : 'New members added!')
      } else {
        setErrorMsg(res.error || 'Üyeler eklenemedi.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir hata oluştu.')
    } finally {
      setIsBusy(false)
    }
  }

  // Remove Member
  const handleRemoveMember = async (targetMember: GroupMember) => {
    const isSelf = targetMember.user_id === currentUserId
    const confirmText = isSelf
      ? t('groups.leave_group_confirm')
      : t('groups.remove_member_confirm', { name: targetMember.profile?.full_name || 'Üye' })

    if (!window.confirm(confirmText)) return

    setIsBusy(true)
    setErrorMsg(null)

    try {
      const res = await removeGroupMember(group.id, targetMember.user_id)
      if (res.success) {
        if (isSelf) {
          onClose()
          router.push('/messages')
        } else {
          const updatedMembers = members.filter(m => m.user_id !== targetMember.user_id)
          onGroupUpdated({}, updatedMembers)
          setSuccessMsg(lang === 'tr' ? 'Üye çıkarıldı.' : 'Member removed.')
        }
      } else {
        setErrorMsg(res.error || 'İşlem başarısız.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir hata oluştu.')
    } finally {
      setIsBusy(false)
    }
  }

  // Toggle Role (Admin / Member)
  const handleToggleRole = async (targetMember: GroupMember) => {
    if (!isAdmin) return
    const newRole: GroupRole = targetMember.role === 'admin' ? 'member' : 'admin'

    setIsBusy(true)
    setErrorMsg(null)

    try {
      const res = await setMemberRole(group.id, targetMember.user_id, newRole)
      if (res.success) {
        const updatedMembers = members.map(m =>
          m.user_id === targetMember.user_id ? { ...m, role: newRole } : m
        )
        onGroupUpdated({}, updatedMembers)
        setSuccessMsg(
          newRole === 'admin'
            ? lang === 'tr' ? 'Kullanıcı yönetici yapıldı.' : 'User promoted to admin.'
            : lang === 'tr' ? 'Kullanıcının yöneticiliği alındı.' : 'Admin role removed.'
        )
      } else {
        setErrorMsg(res.error || 'Rol güncellenemedi.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir hata oluştu.')
    } finally {
      setIsBusy(false)
    }
  }

  // Delete Group
  const handleDeleteGroup = async () => {
    if (!isAdmin) return
    if (!window.confirm(t('groups.delete_group_confirm'))) return

    setIsBusy(true)
    setErrorMsg(null)

    try {
      const res = await deleteGroup(group.id)
      if (res.success) {
        onClose()
        router.push('/messages')
      } else {
        setErrorMsg(res.error || 'Grup silinemedi.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir hata oluştu.')
    } finally {
      setIsBusy(false)
    }
  }

  if (!isOpen) return null

  const filteredAvailableFriends = availableFriends.filter(f =>
    (f.friend?.full_name || '').toLowerCase().includes(friendSearch.toLowerCase().trim())
  )

  const groupInitials = group.name
    ? group.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'G'

  return (
    <div className="group-modal-backdrop" onClick={onClose}>
      <div
        className="group-modal-container group-info-container"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="group-modal-header">
          <div>
            <h3 className="group-modal-title">{t('groups.group_info')}</h3>
            <p className="group-modal-sub">{t('groups.members_count', { count: members.length })}</p>
          </div>
          <button
            type="button"
            className="group-modal-close-btn"
            onClick={onClose}
            aria-label={t('nav.close')}
            disabled={isBusy}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="group-info-body">
          {/* Notifications / Alerts */}
          {errorMsg && <div className="group-modal-alert group-modal-alert--error">{errorMsg}</div>}
          {successMsg && <div className="group-modal-alert group-modal-alert--success">{successMsg}</div>}

          {/* Group Hero Section */}
          {!isEditing ? (
          <div className="group-info-hero">
            <div className="group-info-avatar-wrap">
              {group.avatar_url ? (
                <Image
                  src={group.avatar_url}
                  alt={group.name}
                  width={80}
                  height={80}
                  className="group-info-avatar-img"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <span className="group-info-avatar-fallback">{groupInitials}</span>
              )}
            </div>
            <h3 className="group-info-name">{group.name}</h3>
            {group.description && <p className="group-info-desc">{group.description}</p>}

            {/* Admin Edit Trigger */}
            {isAdmin && (
              <button
                type="button"
                className="btn btn--secondary group-info-edit-btn"
                onClick={() => setIsEditing(true)}
                disabled={isBusy}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                {t('groups.edit_info')}
              </button>
            )}
          </div>
        ) : (
          /* Inline Edit Form (Admin Only) */
          <form onSubmit={handleSaveInfo} className="group-info-edit-form">
            <div className="group-modal-photo-name-row">
              <div
                className="group-modal-photo-picker"
                onClick={() => fileInputRef.current?.click()}
                title={t('groups.photo_label')}
              >
                {editPhotoPreview ? (
                  <Image
                    src={editPhotoPreview}
                    alt="Grup Fotoğrafı"
                    width={68}
                    height={68}
                    className="group-modal-photo-img"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <div className="group-modal-photo-placeholder">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div className="group-modal-name-group">
                <label className="group-modal-label">{t('groups.name_label')} *</label>
                <input
                  type="text"
                  className="group-modal-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>
            </div>

            <div className="group-modal-field">
              <label className="group-modal-label">{t('groups.desc_label')}</label>
              <textarea
                className="group-modal-textarea"
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </div>

            <div className="group-info-edit-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setIsEditing(false)}
                disabled={isBusy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={isBusy || !editName.trim()}
              >
                {isBusy ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        )}

        {/* Member Section Header */}
        <div className="group-info-section-header">
          <span className="group-info-section-title">
            {t('groups.members')} ({members.length})
          </span>

          {/* Admin Add Members Button */}
          {isAdmin && !isAddingMembers && (
            <button
              type="button"
              className="group-info-add-member-btn"
              onClick={handleOpenAddMembers}
              disabled={isBusy}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('groups.add_members')}
            </button>
          )}
        </div>

        {/* Add Members Flow (Drawer style) */}
        {isAddingMembers && (
          <div className="group-info-add-panel">
            <div className="group-modal-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className="group-modal-search-input"
                placeholder={t('friends.search_placeholder')}
                value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
              />
            </div>

            <div className="group-info-add-list">
              {isLoadingFriends ? (
                <div className="group-modal-loading">{t('common.loading')}</div>
              ) : availableFriends.length === 0 ? (
                <p className="group-modal-empty-hint">
                  {lang === 'tr' ? 'Eklenebilecek başka arkadaşınız bulunmuyor.' : 'No more friends to add.'}
                </p>
              ) : (
                filteredAvailableFriends.map(({ friend }) => {
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
                      onClick={() =>
                        setSelectedFriendIds(prev =>
                          prev.includes(friend.id)
                            ? prev.filter(id => id !== friend.id)
                            : [...prev, friend.id]
                        )
                      }
                    >
                      <div className="group-friend-row__avatar">
                        {friend.avatar_url ? (
                          <Image
                            src={friend.avatar_url}
                            alt={friend.full_name || 'Friend'}
                            width={34}
                            height={34}
                            style={{ objectFit: 'cover', borderRadius: '50%' }}
                          />
                        ) : (
                          <span className="group-friend-row__fallback">{initials}</span>
                        )}
                      </div>
                      <div className="group-friend-row__info">
                        <span className="group-friend-row__name">{friend.full_name || 'User'}</span>
                      </div>
                      <div className={`group-checkbox ${isSelected ? 'group-checkbox--checked' : ''}`}>
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="group-info-add-actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setIsAddingMembers(false)}
                disabled={isBusy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleConfirmAddMembers}
                disabled={isBusy || selectedFriendIds.length === 0}
              >
                {isBusy ? t('common.loading') : `${t('common.save')} (${selectedFriendIds.length})`}
              </button>
            </div>
          </div>
        )}

        {/* Existing Member List */}
        <div className="group-info-member-list">
          {members.map(member => {
            const isMe = member.user_id === currentUserId
            const isMemberAdmin = member.role === 'admin'
            const initials = member.profile?.full_name
              ? member.profile.full_name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : '?'

            return (
              <div key={member.id} className="group-info-member-item">
                <div className="group-info-member-left">
                  <div className="group-info-member-avatar">
                    {member.profile?.avatar_url ? (
                      <Image
                        src={member.profile.avatar_url}
                        alt={member.profile.full_name || 'Member'}
                        width={42}
                        height={42}
                        style={{ objectFit: 'cover', borderRadius: '50%' }}
                      />
                    ) : (
                      <span className="group-info-member-fallback">{initials}</span>
                    )}
                  </div>
                  <div className="group-info-member-details">
                    <span className="group-info-member-name">
                      {member.profile?.full_name || 'User'} {isMe && `(${t('groups.you')})`}
                    </span>
                    <span className="group-info-member-role-badge">
                      {isMemberAdmin ? (
                        <span className="badge-admin">★ {t('groups.role_admin')}</span>
                      ) : (
                        <span className="badge-member">{t('groups.role_member')}</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Admin Management Menu / Buttons */}
                <div className="group-info-member-actions">
                  {isAdmin && !isMe && (
                    <>
                      {/* Toggle Role */}
                      <button
                        type="button"
                        className="group-action-btn"
                        title={isMemberAdmin ? t('groups.dismiss_admin') : t('groups.make_admin')}
                        onClick={() => handleToggleRole(member)}
                        disabled={isBusy}
                      >
                        {isMemberAdmin ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        )}
                      </button>

                      {/* Remove Member */}
                      <button
                        type="button"
                        className="group-action-btn group-action-btn--danger"
                        title={t('groups.remove_member')}
                        onClick={() => handleRemoveMember(member)}
                        disabled={isBusy}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer Actions: Leave Group / Delete Group (Fixed Pinned Footer) */}
      <div className="group-info-footer">
        {/* Member Leave Button */}
        <button
          type="button"
          className="btn-group-danger"
          onClick={() => {
            const myMember = members.find(m => m.user_id === currentUserId)
            if (myMember) handleRemoveMember(myMember)
          }}
          disabled={isBusy}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('groups.leave_group')}
        </button>

        {/* Admin Delete Group Button */}
        {isAdmin && (
          <button
            type="button"
            className="btn-group-danger btn-group-danger--solid"
            onClick={handleDeleteGroup}
            disabled={isBusy}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {t('groups.delete_group')}
          </button>
        )}
      </div>
    </div>
  </div>
)
}
