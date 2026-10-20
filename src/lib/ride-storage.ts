import Storage from 'expo-sqlite/kv-store'
import { scopedStorageKey } from '@/lib/storage-scope'

import type { RideDraft, RidePhotoDraft } from '@/lib/ride'

export const RIDE_DRAFT_KEY = scopedStorageKey('cycling-book.active-ride.v1', process.env.EXPO_PUBLIC_SUPABASE_URL!)

export function createRideDraft(plan: RideDraft['plan'] = null): RideDraft {
  const now = Date.now()
  return { startedAt: now, activeStartedAt: now, elapsedBeforeCurrentMs: 0, points: [], currentPoint: null, photos: [], plan }
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

export async function appendRidePhoto(photo: RidePhotoDraft) {
  await Storage.setItem(RIDE_DRAFT_KEY, (stored) => {
    if (!stored) return stored ?? ''
    try {
      const draft = JSON.parse(stored) as RideDraft
      if (draft.photos?.some((item) => item.id === photo.id)) return stored
      return JSON.stringify({ ...draft, photos: [...(draft.photos ?? []), photo] })
    } catch { return stored }
  })
  return loadRideDraft()
}
