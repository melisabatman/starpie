'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendGroupMessage, deleteGroup } from '@/lib/actions/groups'
import AudioMessagePlayer from '@/components/AudioMessagePlayer'
import GroupInfoModal from '@/components/GroupInfoModal'
import { useLanguage } from '@/components/LanguageProvider'
import type { Group, GroupMember, GroupMessage, GroupRole } from '@/lib/types'

interface GroupChatWindowProps {
  currentUserId: string
  initialGroup: Group
  initialMembers: GroupMember[]
  initialCurrentUserRole: GroupRole
  initialMessages: GroupMessage[]
}

function formatTime(isoString: string, lang: 'tr' | 'en', yesterdayText: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    const locale = lang === 'en' ? 'en-US' : 'tr-TR'

    if (isToday) {
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()

    if (isYesterday) {
      return `${yesterdayText} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
    }

    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function formatAudioTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

export default function GroupChatWindow({
  currentUserId,
  initialGroup,
  initialMembers,
  initialCurrentUserRole,
  initialMessages,
}: GroupChatWindowProps) {
  const { t, lang } = useLanguage()
  const router = useRouter()

  const [group, setGroup] = useState<Group>(initialGroup)
  const [members, setMembers] = useState<GroupMember[]>(initialMembers)
  const [currentUserRole, setCurrentUserRole] = useState<GroupRole>(initialCurrentUserRole)
  const [messages, setMessages] = useState<GroupMessage[]>(initialMessages)

  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isUploadingVoice, setIsUploadingVoice] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordStartTimeRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const channelRef = useRef<any>(null)
  const lastBroadcastRef = useRef<number>(0)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Scroll to bottom on mount and on message updates
  useEffect(() => {
    scrollToBottom('auto')
  }, [])

  useEffect(() => {
    scrollToBottom('smooth')
  }, [messages])

  // Clean up recording tracks on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Supabase Realtime Subscription
  useEffect(() => {
    const supabase = createClient()
    const channelName = `group-chat-${group.id}`

    const channel = supabase
      .channel(channelName)
      // New message event
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${group.id}`,
        },
        payload => {
          const newMsg = payload.new as GroupMessage

          // Check if already in state
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev

            // Find sender profile from members list
            const senderMember = members.find(m => m.user_id === newMsg.sender_id)
            const enrichedMsg: GroupMessage = {
              ...newMsg,
              sender: senderMember?.profile || null,
            }
            return [...prev, enrichedMsg]
          })
        }
      )
      // Group info update event
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'groups',
          filter: `id=eq.${group.id}`,
        },
        payload => {
          const updatedGroup = payload.new as Group
          setGroup(prev => ({ ...prev, ...updatedGroup }))
        }
      )
      // Typing indicator broadcast
      .on('broadcast', { event: 'typing' }, payload => {
        const { senderId, senderName } = payload.payload || {}
        if (senderId && senderId !== currentUserId) {
          setTypingUsers(prev => (prev.includes(senderName) ? prev : [...prev, senderName]))

          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers(prev => prev.filter(name => name !== senderName))
          }, 2500)
        }
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [group.id, currentUserId, members])

  // Broadcast typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)

    const now = Date.now()
    if (now - lastBroadcastRef.current > 1500 && channelRef.current) {
      lastBroadcastRef.current = now
      const myMember = members.find(m => m.user_id === currentUserId)
      const myName = myMember?.profile?.full_name || 'Biri'

      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: currentUserId, senderName: myName },
      })
    }
  }

  // Send Text Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const content = inputText.trim()
    if (!content || isSending) return

    setIsSending(true)
    setErrorMsg(null)

    // Optimistic message
    const tempId = `temp-${Date.now()}`
    const myMember = members.find(m => m.user_id === currentUserId)
    const optimisticMsg: GroupMessage = {
      id: tempId,
      group_id: group.id,
      sender_id: currentUserId,
      content,
      message_type: 'text',
      created_at: new Date().toISOString(),
      sender: myMember?.profile || null,
    }

    setMessages(prev => [...prev, optimisticMsg])
    setInputText('')

    try {
      const res = await sendGroupMessage(group.id, content, 'text')
      if (res.success && res.message) {
        setMessages(prev => prev.map(m => (m.id === tempId ? res.message! : m)))
      } else {
        setErrorMsg(res.error || 'Mesaj iletilemedi.')
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Mesaj gönderilirken hata oluştu.')
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  // Quick Delete Group (Admin)
  const handleDeleteGroup = async () => {
    if (currentUserRole !== 'admin') return
    const confirmMsg =
      lang === 'tr'
        ? `"${group.name}" grubunu ve tüm sohbet geçmişini kalıcı olarak silmek istediğinden emin misin? Bu işlem geri alınamaz!`
        : `Are you sure you want to permanently delete "${group.name}"? This cannot be undone!`

    if (!window.confirm(confirmMsg)) return

    try {
      const res = await deleteGroup(group.id)
      if (res.success) {
        router.push('/messages')
      } else {
        alert(res.error || (lang === 'tr' ? 'Grup silinemedi.' : 'Failed to delete group.'))
      }
    } catch (err: any) {
      alert(err.message || 'Hata oluştu.')
    }
  }

  // Voice Message Recording
  const startRecording = async () => {
    if (isRecording || isUploadingVoice) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioDuration = Math.round((Date.now() - recordStartTimeRef.current) / 1000)

        if (audioDuration < 1) {
          setErrorMsg(lang === 'tr' ? 'Ses kaydı çok kısa.' : 'Audio recording too short.')
          return
        }

        const mime = mediaRecorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mime })

        await uploadAndSendVoiceMessage(audioBlob, mime)
      }

      mediaRecorder.start(200)
      recordStartTimeRef.current = Date.now()
      setIsRecording(true)
      setRecordingSeconds(0)

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1)
      }, 1000)
    } catch (err) {
      console.error('Error starting audio recording:', err)
      setErrorMsg(t('messages.mic_denied'))
    }
  }

  const stopRecording = () => {
    if (!isRecording) return
    setIsRecording(false)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  const cancelRecording = () => {
    if (!isRecording) return
    setIsRecording(false)
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    audioChunksRef.current = []
  }

  const uploadAndSendVoiceMessage = async (blob: Blob, mimeType: string) => {
    setIsUploadingVoice(true)
    setErrorMsg(null)

    try {
      const supabase = createClient()
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const fileName = `${currentUserId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, blob, { contentType: mimeType })

      if (uploadError) {
        setErrorMsg('Ses dosyası yüklenemedi: ' + uploadError.message)
        setIsUploadingVoice(false)
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('voice-messages').getPublicUrl(fileName)

      const res = await sendGroupMessage(group.id, null, 'audio', publicUrl)
      if (res.success && res.message) {
        setMessages(prev => [...prev, res.message!])
      } else {
        setErrorMsg(res.error || 'Sesli mesaj gönderilemedi.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sesli mesaj gönderilemedi.')
    } finally {
      setIsUploadingVoice(false)
    }
  }

  // Handle updates from GroupInfoModal
  const handleGroupUpdated = (updatedGroup: Partial<Group>, updatedMembers?: GroupMember[]) => {
    setGroup(prev => ({ ...prev, ...updatedGroup }))
    if (updatedMembers) {
      setMembers(updatedMembers)
      const myMembership = updatedMembers.find(m => m.user_id === currentUserId)
      if (myMembership) {
        setCurrentUserRole(myMembership.role)
      }
    }
  }

  const groupInitials = group.name
    ? group.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'G'

  return (
    <div className="chat-window-container group-chat-container">
      {/* Group Chat Header */}
      <div className="chat-header group-chat-header">
        <div className="chat-header__left">
          {/* Back to messages list */}
          <Link href="/messages" className="chat-back-btn" title={t('common.back')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>

          {/* Group Avatar & Info (clickable to open info modal) */}
          <div
            className="chat-partner-info group-partner-info"
            onClick={() => setInfoModalOpen(true)}
            role="button"
            tabIndex={0}
          >
            <div className="chat-partner-avatar group-partner-avatar">
              {group.avatar_url ? (
                <Image
                  src={group.avatar_url}
                  alt={group.name}
                  width={44}
                  height={44}
                  style={{ objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                <span className="group-avatar-fallback">{groupInitials}</span>
              )}
            </div>

            <div className="chat-partner-meta">
              <h4 className="chat-partner-name">{group.name}</h4>
              <span className="chat-partner-status">
                {typingUsers.length > 0 ? (
                  <span className="typing-indicator-text">
                    {typingUsers.join(', ')} {lang === 'tr' ? 'yazıyor...' : 'is typing...'}
                  </span>
                ) : (
                  <span>{t('groups.members_count', { count: members.length })}</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Header Right: Group Info Drawer Trigger & Quick Delete */}
        <div className="chat-header__right group-chat-header-actions">
          {currentUserRole === 'admin' && (
            <button
              type="button"
              className="btn-chat-delete-group"
              onClick={handleDeleteGroup}
              title={lang === 'tr' ? 'Grubu Sil' : 'Delete Group'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>{lang === 'tr' ? 'Grubu Sil' : 'Delete'}</span>
            </button>
          )}

          <button
            type="button"
            className="group-info-toggle-btn"
            onClick={() => setInfoModalOpen(true)}
            title={t('groups.group_info')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="group-info-toggle-text">{lang === 'tr' ? 'Grup Bilgisi' : 'Info'}</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="chat-messages group-chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome group-chat-welcome">
            <div className="chat-welcome__avatar group-welcome-avatar">
              {group.avatar_url ? (
                <Image
                  src={group.avatar_url}
                  alt={group.name}
                  width={64}
                  height={64}
                  style={{ objectFit: 'cover', borderRadius: '50%' }}
                />
              ) : (
                <span>{groupInitials}</span>
              )}
            </div>
            <h3 className="chat-welcome__name">{group.name}</h3>
            <p className="chat-welcome__hint">
              {lang === 'tr'
                ? 'Grup sohbeti başlatıldı! İlk mesajı göndererek sohbete katılın.'
                : 'Group chat started! Send the first message to join the conversation.'}
            </p>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((msg, index) => {
          const isMe = msg.sender_id === currentUserId
          const senderName = isMe ? t('groups.you') : msg.sender?.full_name || 'Üye'
          const showSenderHeader = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id)

          return (
            <div
              key={msg.id}
              className={`chat-bubble-row ${isMe ? 'chat-bubble-row--self' : 'chat-bubble-row--partner'} ${
                msg.message_type === 'audio' ? 'chat-bubble-row--audio' : ''
              }`}
            >
              {/* Partner Avatar in group */}
              {!isMe && (
                <div className="group-bubble-avatar">
                  {msg.sender?.avatar_url ? (
                    <Image
                      src={msg.sender.avatar_url}
                      alt={senderName}
                      width={28}
                      height={28}
                      style={{ objectFit: 'cover', borderRadius: '50%' }}
                    />
                  ) : (
                    <span className="group-bubble-avatar-fallback">
                      {(msg.sender?.full_name || '?')[0].toUpperCase()}
                    </span>
                  )}
                </div>
              )}

              <div className={`chat-bubble ${isMe ? 'chat-bubble--self' : 'chat-bubble--partner'} group-bubble`}>
                {/* Sender Name in group for incoming bubbles */}
                {!isMe && showSenderHeader && (
                  <span className="group-bubble-sender-name">{senderName}</span>
                )}

                {/* Bubble Content: Audio or Text */}
                {msg.message_type === 'audio' && msg.audio_url ? (
                  <AudioMessagePlayer src={msg.audio_url} isMe={isMe} />
                ) : (
                  <p className="chat-bubble__text">{msg.content}</p>
                )}

                <div className="chat-bubble__meta">
                  <span className="chat-bubble__time">
                    {formatTime(msg.created_at, lang, t('messages.yesterday'))}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="chat-error-banner">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)}>×</button>
        </div>
      )}

      {/* Voice Recording Active Bar */}
      {isRecording ? (
        <div className="chat-recording-bar">
          <div className="chat-recording-indicator">
            <span className="chat-recording-dot"></span>
            <span className="chat-recording-timer">{formatAudioTimer(recordingSeconds)}</span>
          </div>
          <span className="chat-recording-hint">{t('messages.release_to_send')}</span>
          <div className="chat-recording-actions">
            <button
              type="button"
              className="chat-recording-cancel-btn"
              onClick={cancelRecording}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="chat-recording-stop-btn"
              onClick={stopRecording}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        /* Standard Input Bar */
        <form onSubmit={handleSendMessage} className="chat-input-bar">
          {/* Voice Record Button */}
          <button
            type="button"
            className="chat-mic-btn"
            title={t('messages.hold_to_record')}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={isSending || isUploadingVoice}
          >
            {isUploadingVoice ? (
              <span className="spinner-dots"></span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={t('messages.type_placeholder')}
            value={inputText}
            onChange={handleInputChange}
            disabled={isSending}
            maxLength={2000}
          />

          {/* Send Button */}
          <button
            type="submit"
            className="chat-send-btn"
            disabled={isSending || !inputText.trim()}
            title={t('messages.send')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      )}

      {/* Group Info Modal */}
      <GroupInfoModal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        group={group}
        members={members}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        onGroupUpdated={handleGroupUpdated}
      />
    </div>
  )
}
