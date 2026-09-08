export type Profile = {
  id: string
  full_name: string | null
  profession: string | null
  bio: string | null
  avatar_url: string | null
  updated_at: string | null
  role?: 'user' | 'admin'
  email_notifications_enabled?: boolean
  last_seen_at?: string | null
}

export type Post = {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
}

export type PostComment = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  author?: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url' | 'role'> | null
}

export type FeedPost = Post & {
  author?: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url' | 'role'> | null
  likes_count: number
  has_liked: boolean
  comments_count: number
  reposts_count: number
  has_reposted: boolean
  feed_timestamp?: string
  repost?: {
    id: string
    user_id: string
    created_at: string
    reposter: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  } | null
}


export type FriendshipStatus = 'pending' | 'accepted' | 'rejected'

export type Friendship = {
  id: string
  sender_id: string
  receiver_id: string
  status: FriendshipStatus
  created_at: string
  updated_at: string
}

export type FriendRequest = {
  id: string
  sender_id: string
  created_at: string
  sender: {
    id: string
    full_name: string | null
    profession: string | null
    avatar_url: string | null
  } | null
}

export type Friend = {
  friendship_id: string
  friend: {
    id: string
    full_name: string | null
    profession: string | null
    avatar_url: string | null
  } | null
}

export type SearchUser = {
  id: string
  full_name: string | null
  profession: string | null
  avatar_url: string | null
  friendship_id: string | null
  friendship_status: FriendshipStatus | null
  friendship_sender_id: string | null
}

export type MessageType = 'text' | 'audio'

export type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string | null
  message_type?: MessageType
  audio_url?: string | null
  is_read: boolean
  created_at: string
}

export type Conversation = {
  friend: {
    id: string
    full_name: string | null
    profession: string | null
    avatar_url: string | null
  }
  last_message: Message | null
  unread_count: number
}

export type CoupleSpaceStatus = 'pending' | 'accepted' | 'rejected'

export type CoupleSpace = {
  id: string
  user1_id: string
  user2_id: string
  status: CoupleSpaceStatus
  title: string
  created_at: string
  updated_at: string
  partner?: {
    id: string
    full_name: string | null
    profession: string | null
    avatar_url: string | null
  } | null
  is_creator?: boolean
}

export type Memory = {
  id: string
  space_id: string
  user_id: string
  image_url: string
  caption: string | null
  memory_date: string
  rotation: number
  created_at: string
  uploader?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export type MoodEntry = {
  id: string
  space_id: string
  user_id: string
  emoji: string
  mood_label: string
  note: string | null
  entry_date: string
  created_at: string
  updated_at: string
  user?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

export type SharedEvent = {
  id: string
  space_id: string
  user_id: string
  title: string
  description: string | null
  event_date: string // YYYY-MM-DD
  event_time: string | null // HH:MM or HH:MM:SS
  created_at: string
  updated_at: string
  creator?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

import type { DrawnTarotCard } from '@/lib/tarot-deck'

export type TarotReading = {
  id: string
  user_id: string
  question: string
  cards: DrawnTarotCard[]
  summary: string
  created_at: string
}

export type AdminPost = {
  id: string
  author_id: string
  title: string
  content: string
  excerpt: string | null
  cover_image_url: string | null
  created_at: string
  updated_at: string
  author?: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url' | 'role'> | null
}

export type JournalEntry = {
  id: string
  space_id: string
  user_id: string
  title: string | null
  content: string
  image_url: string | null
  entry_date: string
  created_at: string
  updated_at: string
  author?: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url'> | null
}

export type TimelinePost = {
  id: string
  wall_user_id: string
  author_id: string
  content: string
  created_at: string
  author?: Pick<Profile, 'id' | 'full_name' | 'profession' | 'avatar_url' | 'role'> | null
}
