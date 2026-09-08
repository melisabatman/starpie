'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, sendVoiceMessage, markMessagesAsRead } from '@/lib/actions/messages'
import AudioMessagePlayer from '@/components/AudioMessagePlayer'
import { useLanguage } from '@/components/LanguageProvider'
import type { Message, Profile } from '@/lib/types'

interface ChatWindowProps {
  currentUserId: string
  partner: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'>
  initialMessages: Message[]
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

export default function ChatWindow({
  currentUserId,
  partner,
  initialMessages,
}: ChatWindowProps) {
  const { t, lang } = useLanguage()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Voice Recording State ──
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [isUploadingVoice, setIsUploadingVoice] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordStartTimeRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  // Scroll on mount and partner change
  useEffect(() => {
    scrollToBottom('auto')
    markMessagesAsRead(partner.id)
  }, [partner.id])

  useEffect(() => {
    scrollToBottom('smooth')
  }, [messages])

  // Clean up recording timer and tracks on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Setup Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channelName = `chat-messages-${[currentUserId, partner.id].sort().join('-')}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        payload => {
          const newMsg = payload.new as Message

          const isRelevant =
            (newMsg.sender_id === partner.id && newMsg.receiver_id === currentUserId) ||
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === partner.id)

          if (isRelevant) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              return [...prev, newMsg]
            })

            if (newMsg.sender_id === partner.id) {
              markMessagesAsRead(partner.id)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, partner.id])

  // ── Send Text Message ──
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = inputText.trim()
    if (!content || isSending) return

    setIsSending(true)
    setErrorMsg(null)
    setInputText('')

    const optimisticId = `temp-${Date.now()}`
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: currentUserId,
      receiver_id: partner.id,
      content,
      message_type: 'text',
      is_read: false,
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, optimisticMessage])

    try {
      const result = await sendMessage(partner.id, content)
      if (result.success && result.message) {
        setMessages(prev =>
          prev.map(m => (m.id === optimisticId ? result.message! : m))
        )
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
        setErrorMsg(result.error || 'Mesaj gönderilemedi.')
        setInputText(content)
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setErrorMsg('Bir bağlantı hatası oluştu.')
      setInputText(content)
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Voice Recording Handlers (Press & Hold) ──
  const startRecording = async (e: React.PointerEvent) => {
    e.preventDefault()
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {}

    setErrorMsg(null)

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg('Tarayıcınız ses kaydını desteklemiyor.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []

      let options: MediaRecorderOptions = {}
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' }
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' }
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' }
        }
      }

      const recorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.start(100)
      recordStartTimeRef.current = Date.now()
      setIsRecording(true)
      setRecordingSeconds(0)

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1)
      }, 1000)
    } catch (err: any) {
      console.error('Mic access error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Mikrofon erişim izni verilmedi. Lütfen tarayıcı ayarlarından mikrofonu etkinleştirin.')
      } else {
        setErrorMsg('Mikrofona erişilemedi: ' + (err.message || 'Hata'))
      }
    }
  }

  const stopRecording = async (e?: React.PointerEvent) => {
    if (!isRecording) return

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }

    const durationMs = Date.now() - recordStartTimeRef.current
    setIsRecording(false)

    const recorder = mediaRecorderRef.current
    const stream = streamRef.current

    if (!recorder) return

    // Accidental tap check (< 600ms)
    if (durationMs < 600) {
      if (recorder.state !== 'inactive') recorder.stop()
      stream?.getTracks().forEach(t => t.stop())
      setErrorMsg('Ses kaydetmek için butona basılı tutun.')
      return
    }

    setIsUploadingVoice(true)

    recorder.onstop = async () => {
      stream?.getTracks().forEach(t => t.stop())

      try {
        const mimeType = recorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
        const fileName = `${currentUserId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`

        const supabase = createClient()
        const { error: uploadError } = await supabase.storage
          .from('voice-messages')
          .upload(fileName, audioBlob, { contentType: mimeType })

        if (uploadError) {
          setErrorMsg('Ses dosyası yüklenemedi: ' + uploadError.message)
          setIsUploadingVoice(false)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('voice-messages').getPublicUrl(fileName)

        // Optimistic voice message
        const tempId = `temp-${Date.now()}`
        const optimisticMessage: Message = {
          id: tempId,
          sender_id: currentUserId,
          receiver_id: partner.id,
          content: '🎤 Sesli mesaj',
          message_type: 'audio',
          audio_url: publicUrl,
          is_read: false,
          created_at: new Date().toISOString(),
        }

        setMessages(prev => [...prev, optimisticMessage])

        const result = await sendVoiceMessage(partner.id, publicUrl)
        if (result.success && result.message) {
          setMessages(prev =>
            prev.map(m => (m.id === tempId ? result.message! : m))
          )
        } else {
          setMessages(prev => prev.filter(m => m.id !== tempId))
          setErrorMsg(result.error || 'Sesli mesaj gönderilemedi.')
        }
      } catch (err: any) {
        console.error('Audio upload error:', err)
        setErrorMsg('Sesli mesaj gönderilirken hata oluştu.')
      } finally {
        setIsUploadingVoice(false)
      }
    }

    if (recorder.state !== 'inactive') {
      recorder.stop()
    }
  }

  const cancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    setIsRecording(false)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  const partnerInitials = partner.full_name
    ? partner.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <div className="chat-window">
      {/* ── Chat Header ── */}
      <div className="chat-header">
        <Link href="/messages" className="chat-header__back" title="Sohbetlere Dön">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        <Link href={`/profile/${partner.id}`} className="chat-header__user">
          <div className="chat-header__avatar">
            {partner.avatar_url ? (
              <Image
                src={partner.avatar_url}
                alt={partner.full_name ?? 'Avatar'}
                width={42}
                height={42}
                style={{ objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              <span className="chat-header__fallback">{partnerInitials}</span>
            )}
            <span className="chat-online-dot" title="Aktif" />
          </div>

          <div className="chat-header__info">
            <h2 className="chat-header__name">{partner.full_name ?? 'İsimsiz'}</h2>
            {partner.profession ? (
              <p className="chat-header__sub">{partner.profession}</p>
            ) : (
              <p className="chat-header__sub chat-header__sub--status">Arkadaşın</p>
            )}
          </div>
        </Link>

        <Link
          href={`/profile/${partner.id}`}
          className="chat-header__profile-btn"
          title={t('messages.view_profile')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </Link>
      </div>

      {/* ── Chat Messages Container ── */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty__icon">🌸</div>
            <p className="chat-empty__title">
              {partner.full_name ?? t('profile.nameless')}
            </p>
            <p className="chat-empty__sub">
              {t('messages.type_placeholder')}
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === currentUserId
            const isAudio = msg.message_type === 'audio' || !!msg.audio_url

            return (
              <div
                key={msg.id}
                className={`chat-bubble-row ${isMe ? 'chat-bubble-row--me' : 'chat-bubble-row--them'}`}
              >
                <div
                  className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--them'} ${isAudio ? 'chat-bubble--audio' : ''}`}
                >
                  {isAudio && msg.audio_url ? (
                    <AudioMessagePlayer src={msg.audio_url} isMe={isMe} />
                  ) : (
                    <p className="chat-bubble__content">{msg.content}</p>
                  )}

                  <div className="chat-bubble__meta">
                    <span className="chat-bubble__time">
                      {formatTime(msg.created_at, lang, t('messages.yesterday'))}
                    </span>
                    {isMe && (
                      <span
                        className="chat-bubble__status"
                        title={msg.is_read ? t('common.yes') : t('common.no')}
                      >
                        {msg.is_read ? (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="18 6 7 17 2 12" />
                            <polyline points="22 10 13 19 11 17" />
                          </svg>
                        ) : (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Error Banner ── */}
      {errorMsg && (
        <div className="chat-error-banner">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} aria-label={t('nav.close')}>
            ✕
          </button>
        </div>
      )}

      {/* ── Chat Input / Recording Bar ── */}
      {isRecording ? (
        <div className="chat-recording-bar">
          <div className="chat-recording-indicator">
            <span className="recording-dot" />
            <span className="recording-timer">{formatAudioTimer(recordingSeconds)}</span>
          </div>

          <p className="recording-hint">
            {t('messages.recording')} {t('messages.release_to_send')} 🎙️
          </p>

          <button
            type="button"
            className="chat-mic-btn chat-mic-btn--recording"
            onPointerUp={stopRecording}
            onPointerCancel={cancelRecording}
            title={t('messages.release_to_send')}
            aria-label={t('messages.release_to_send')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        </div>
      ) : (
        <form className="chat-input-bar" onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            id="chat-message-input"
            className="chat-input-field"
            placeholder={t('messages.type_placeholder')}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            maxLength={2000}
            autoComplete="off"
            disabled={isSending || isUploadingVoice}
          />

          {inputText.trim() ? (
            <button
              type="submit"
              id="chat-send-btn"
              className="chat-send-btn"
              disabled={isSending}
              aria-label={t('messages.send')}
            >
              {isSending ? (
                <span className="spinner spinner--sm" />
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          ) : (
            <button
              type="button"
              id="chat-mic-btn"
              className="chat-mic-btn"
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerCancel={cancelRecording}
              disabled={isUploadingVoice}
              title={t('messages.hold_to_record')}
              aria-label={t('messages.voice_message')}
            >
              {isUploadingVoice ? (
                <span className="spinner spinner--sm" />
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          )}
        </form>
      )}
    </div>
  )
}
