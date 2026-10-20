import Storage from 'expo-sqlite/kv-store'
import { scopedStorageKey } from '@/lib/storage-scope'

import type { PendingRide } from '@/lib/ride-sync-model'
import { generateAndSaveRunElevation } from '@/lib/elevation'
import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system/legacy'
import { removeRidePhotoFiles } from '@/lib/ride-photo-capture'

const PENDING_RIDES_KEY = scopedStorageKey('cycling-book.pending-rides.v1', process.env.EXPO_PUBLIC_SUPABASE_URL!)
let activeSync: Promise<SyncResult> | null = null

export type SyncResult = { synced: number; pending: number; error: Error | null }

export async function loadPendingRides() {
  const stored = await Storage.getItem(PENDING_RIDES_KEY)
  if (!stored) return [] as PendingRide[]
  try {
    const value = JSON.parse(stored) as unknown
    return Array.isArray(value) ? value as PendingRide[] : []
  } catch {
    return [] as PendingRide[]
  }
}

async function savePendingRides(rides: PendingRide[]) {
  if (rides.length === 0) return Storage.removeItem(PENDING_RIDES_KEY)
  return Storage.setItem(PENDING_RIDES_KEY, JSON.stringify(rides))
}

export async function enqueuePendingRide(ride: PendingRide) {
  const rides = await loadPendingRides()
  if (!rides.some((item) => item.localId === ride.localId)) {
    rides.push(ride)
    await savePendingRides(rides)
  }
}

export async function pendingRideCount(userId: string) {
  return (await loadPendingRides()).filter((ride) => ride.userId === userId).length
}

async function accountIdForUser(userId: string) {
  const { data, error } = await supabase.from('users').select('account_id').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data?.account_id) throw new Error('Account information is unavailable')
  return data.account_id
}

async function uploadRide(ride: PendingRide, accountId: string) {
  const { data: existing, error: lookupError } = await supabase
    .from('runs')
    .select('id')
    .eq('account_id', accountId)
    .eq('started_at', ride.startedAt)
    .eq('ended_at', ride.endedAt)
    .limit(1)
  if (lookupError) throw lookupError
  if (existing?.length) return existing[0].id as string | number

  const { data, error } = await supabase.from('runs').insert({
    account_id: accountId,
    name: ride.name,
    started_at: ride.startedAt,
    ended_at: ride.endedAt,
    distance_m: ride.distanceMeters,
    duration_s: ride.durationSeconds,
    geojson: ride.geojson,
    polyline: ride.polyline,
    route_id: ride.routeId,
    mode: ride.mode,
  }).select('id').single()
  if (error) throw error
  return data.id as string | number
}

function decodeBase64(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '')
  const output = new Uint8Array(Math.floor(clean.length * 3 / 4))
  let buffer = 0; let bits = 0; let offset = 0
  for (const character of clean) {
    buffer = (buffer << 6) | alphabet.indexOf(character)
    bits += 6
    if (bits < 8) continue
    bits -= 8
    output[offset++] = (buffer >> bits) & 0xff
  }
  return output.slice(0, offset)
}

async function uploadLocalFile(path: string, uri: string, contentType: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
  const { error } = await supabase.storage.from('route-photos').upload(path, decodeBase64(base64), { contentType, upsert: true })
  if (error) throw error
}

async function uploadRidePhotos(ride: PendingRide, runId: string | number, accountId: string) {
  for (const photo of ride.photos ?? []) {
    const extension = photo.originalUri.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || 'jpg'
    const originalPath = `runs/${accountId}/${runId}/${photo.id}/original.${extension}`
    const thumbnailPath = `runs/${accountId}/${runId}/${photo.id}/thumbnail.jpg`
    await uploadLocalFile(originalPath, photo.originalUri, photo.mimeType)
    await uploadLocalFile(thumbnailPath, photo.thumbnailUri, 'image/jpeg')
    const info = await FileSystem.getInfoAsync(photo.originalUri)
    const byteSize = info.exists && 'size' in info ? info.size : null
    const { error } = await supabase.from('run_photos').upsert({
      id: photo.id,
      run_id: runId,
      owner_user_id: ride.userId,
      account_id: accountId,
      bucket_id: 'route-photos',
      original_path: originalPath,
      thumbnail_path: thumbnailPath,
      taken_at: photo.takenAt,
      latitude: photo.latitude,
      longitude: photo.longitude,
      mime_type: photo.mimeType,
      byte_size: byteSize,
      width: photo.width,
      height: photo.height,
    }, { onConflict: 'id' })
    if (error) throw error
  }
}

async function performSync(userId: string): Promise<SyncResult> {
  const allRides = await loadPendingRides()
  const userRides = allRides.filter((ride) => ride.userId === userId)
  if (userRides.length === 0) return { synced: 0, pending: 0, error: null }

  let synced = 0
  let error: Error | null = null
  let remaining = [...allRides]
  try {
    const accountId = await accountIdForUser(userId)
    for (const ride of userRides) {
      try {
        const runId = await uploadRide(ride, accountId)
        await uploadRidePhotos(ride, runId, accountId)
        remaining = (await loadPendingRides()).filter((item) => item.localId !== ride.localId)
        await savePendingRides(remaining)
        await removeRidePhotoFiles(ride.photos)
        synced += 1
        const points = ride.geojson.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }))
        void generateAndSaveRunElevation(runId, accountId, points).catch(() => undefined)
      } catch (cause) {
        error = cause instanceof Error ? cause : new Error(String(cause))
        break
      }
    }
  } catch (cause) {
    error = cause instanceof Error ? cause : new Error(String(cause))
  }
  remaining = await loadPendingRides()
  return { synced, pending: remaining.filter((ride) => ride.userId === userId).length, error }
}

export function syncPendingRides(userId: string) {
  if (!activeSync) activeSync = performSync(userId).finally(() => { activeSync = null })
  return activeSync
}
