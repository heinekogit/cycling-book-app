import { supabase } from '@/lib/supabase'

export type RoutePhoto = { markerId?: string | null; isPrivacyHidden?: boolean; id: string; imageUrl: string; thumbUrl: string | null; takenAt: string | null; latitude: number | null; longitude: number | null }

const BUCKET = 'route-photos'

function storagePath(url: string) {
  if (!url.includes('://')) return url.replace(/^\/+/, '')
  for (const access of ['public', 'sign', 'authenticated']) {
    const marker = `/storage/v1/object/${access}/${BUCKET}/`
    if (!url.includes(marker)) continue
    const encoded = url.split(marker)[1]?.split('?')[0]
    if (!encoded) return null
    try { return decodeURIComponent(encoded) } catch { return encoded }
  }
  return null
}

async function signedUrl(url: string | null) {
  if (!url) return null
  const path = storagePath(url)
  if (!path) return url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  return error ? null : data.signedUrl
}

export async function fetchRoutePhotos(routeId: string) {
  const { data, error } = await supabase.from('route_spot_photos').select('id,image_url,thumb_url,taken_at,lat,lng,marker_id,is_privacy_hidden').eq('route_id', routeId).order('sort_order', { ascending: true }).order('taken_at', { ascending: true })
  if (error) throw error
  return Promise.all((data ?? []).map(async (photo) => {
    const imageUrl = await signedUrl(photo.image_url)
    const thumbUrl = await signedUrl(photo.thumb_url)
    return { markerId: photo.marker_id == null ? null : String(photo.marker_id), isPrivacyHidden: photo.is_privacy_hidden === true, id: String(photo.id), imageUrl: imageUrl || photo.image_url, thumbUrl: thumbUrl || imageUrl, takenAt: photo.taken_at, latitude: finiteCoordinate(photo.lat, 90), longitude: finiteCoordinate(photo.lng, 180) } satisfies RoutePhoto
  }))
}

export async function fetchDirectRunPhotos(runId: string) {
  const { data, error } = await supabase.from('run_photos').select('id,original_path,thumbnail_path,taken_at,latitude,longitude').eq('run_id', runId).order('taken_at', { ascending: false })
  if (error) throw error
  return Promise.all((data ?? []).map(async (photo) => {
    const imageUrl = await signedUrl(photo.original_path)
    const thumbUrl = await signedUrl(photo.thumbnail_path)
    return { id: String(photo.id), imageUrl: imageUrl || photo.original_path, thumbUrl: thumbUrl || imageUrl, takenAt: photo.taken_at, latitude: finiteCoordinate(photo.latitude, 90), longitude: finiteCoordinate(photo.longitude, 180) } satisfies RoutePhoto
  }))
}

function finiteCoordinate(value: unknown, maximum: number) {
  const coordinate = Number(value)
  return value == null || !Number.isFinite(coordinate) || Math.abs(coordinate) > maximum ? null : coordinate
}
