'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/components/LanguageProvider'

interface AudioMessagePlayerProps {
  src: string
  isMe: boolean
}

// Sample fixed bar heights for a natural voice waveform look
const WAVEFORM_BARS = [
  8, 14, 20, 12, 26, 18, 30, 16, 22, 28, 14, 24, 32, 20, 16, 26, 12, 18, 10, 14,
]

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

export default function AudioMessagePlayer({ src, isMe }: AudioMessagePlayerProps) {
  const { t } = useLanguage()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      if (audio.duration && (!duration || isNaN(duration))) {
        setDuration(audio.duration)
      }
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [duration])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Audio playback failed:', err)
          setIsPlaying(false)
        })
    }
  }

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))
    const newTime = percentage * duration

    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={`audio-player ${isMe ? 'audio-player--me' : 'audio-player--them'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause button */}
      <button
        type="button"
        className="audio-player__btn"
        onClick={togglePlay}
        aria-label={isPlaying ? t('messages.audio_pause') : t('messages.audio_play')}
      >
        {isPlaying ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <rect x="6" y="4" width="4" height="16" rx="1.5" />
            <rect x="14" y="4" width="4" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ transform: 'translateX(1px)' }}
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Waveform and progress */}
      <div className="audio-player__body">
        <div
          className="audio-player__waveform"
          onClick={handleWaveformClick}
        >
          {WAVEFORM_BARS.map((barHeight, idx) => {
            const barPercentage = (idx / WAVEFORM_BARS.length) * 100
            const isFilled = progressPercentage >= barPercentage
            return (
              <span
                key={idx}
                className={`waveform-bar ${isFilled ? 'waveform-bar--filled' : ''} ${isPlaying ? 'waveform-bar--playing' : ''}`}
                style={{
                  height: `${barHeight}px`,
                  animationDelay: `${(idx % 5) * 0.1}s`,
                }}
              />
            )
          })}
        </div>

        {/* Time display */}
        <div className="audio-player__footer">
          <span className="audio-player__time">
            {isPlaying ? formatAudioTime(currentTime) : formatAudioTime(duration || 0)}
          </span>
          <span className="audio-player__tag">{t('messages.voice_message')}</span>
        </div>
      </div>
    </div>
  )
}
