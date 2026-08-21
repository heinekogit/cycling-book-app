import Storage from 'expo-sqlite/kv-store'

import type { RideDraft } from '@/lib/ride'

export const RIDE_DRAFT_KEY = 'cycling-book.active-ride.v1'

export function createRideDraft(): RideDraft {
  const now = Date.now()
  return { startedAt: now, activeStartedAt: now, elapsedBeforeCurrentMs: 0, points: [], currentPoint: null }
}

export async function loadRideDraft() {
  const stored = await Storage.getItem(RIDE_DRAFT_KEY)
  if (!stored) return null
  try { return JSON.parse(stored) as RideDraft } catch { return null }
}

export function saveRideDraft(draft: RideDraft) {
  return Storage.setItem(RIDE_DRAFT_KEY, JSON.stringify(draft))
}

export function clearRideDraft() {
  return Storage.removeItem(RIDE_DRAFT_KEY)
}
