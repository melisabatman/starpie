'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DrawnTarotCard } from '@/lib/tarot-deck'
import type { TarotReading } from '@/lib/types'

export async function saveTarotReading(
  question: string,
  cards: DrawnTarotCard[],
  summary: string
): Promise<{ success: boolean; reading?: TarotReading; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const cleanQuestion = question.trim()
  if (!cleanQuestion) {
    return { success: false, error: 'Lütfen merak ettiğiniz bir soru yazın.' }
  }

  if (!cards || cards.length !== 3) {
    return { success: false, error: 'Geçerli bir 3 kart açılımı bulunamadı.' }
  }

  const { data, error } = await supabase
    .from('tarot_readings')
    .insert({
      user_id: user.id,
      question: cleanQuestion,
      cards: cards,
      summary: summary,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving tarot reading:', error)
    return { success: false, error: 'Fal kaydedilemedi: ' + error.message }
  }

  revalidatePath('/tarot')

  return { success: true, reading: data as TarotReading }
}

export async function getTarotHistory(): Promise<TarotReading[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('tarot_readings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('Error fetching tarot history:', error)
    return []
  }

  return data as TarotReading[]
}

export async function deleteTarotReading(
  readingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Giriş yapmanız gerekiyor.' }
  }

  const { error } = await supabase
    .from('tarot_readings')
    .delete()
    .eq('id', readingId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting tarot reading:', error)
    return { success: false, error: 'Fal silinemedi: ' + error.message }
  }

  revalidatePath('/tarot')

  return { success: true }
}
