import type { TFunction } from '@/i18n'
import { supabase } from '@/lib/supabase'
import { extractRoutePoints } from './publication-geometry'
import { publicationPreview, type PublicationContext } from './route-publication-model'
export { publicationPreview, type PublicationContext } from './route-publication-model'

export async function prepareRoutePublication(userId: string, routeId: string, t: TFunction): Promise<PublicationContext> {
  const results = await Promise.all([
    supabase.from('users').select('home_lat,home_lng').eq('id', userId).maybeSingle(),
    supabase.from('routes').select('geojson,polyline').eq('id', routeId).single(),
    supabase.from('route_private_geometries').select('geojson,polyline').eq('route_id', routeId).maybeSingle(),
    supabase.from('route_spot_photos').select('id,lat,lng,marker_id').eq('route_id', routeId),
    supabase.from('route_markers').select('id,latitude,longitude').eq('route_id', routeId),
  ])
  for (const result of results) if (result.error) throw result.error
  const [profile, route, original, photos, markers] = results
  const home = { lat: Number(profile.data?.home_lat), lng: Number(profile.data?.home_lng) }
  if (profile.data?.home_lat == null || profile.data.home_lng == null || !Number.isFinite(home.lat) || !Number.isFinite(home.lng) || Math.abs(home.lat) > 90 || Math.abs(home.lng) > 180) throw new Error(t('privacyHomeMissing'))
  return { home, points: extractRoutePoints(original.data ?? route.data!), photos: photos.data ?? [], markers: markers.data ?? [] }
}

export async function setRoutePublication(routeId: string, makePublic: boolean, t: TFunction, preview?: ReturnType<typeof publicationPreview>) {
  if (makePublic && !preview?.segments.length) throw new Error(t('privacyNoSegments'))
  const { data, error } = await supabase.rpc('set_route_publication', {
    requested_route_id: routeId, make_public: makePublic,
    filtered_geojson: preview?.publicGeoJson ?? null,
    filter_enabled: preview?.filterEnabled ?? false, radius_m: 500,
    filtered_distance_m: preview?.publicDistanceM ?? null,
    hidden_photo_ids: preview?.hiddenPhotoIds ?? [], hidden_marker_ids: preview?.hiddenMarkerIds ?? [],
  })
  if (error) throw new Error(error.message.includes('free_public_route_limit_reached') ? t('publicRouteLimitReached') : error.message)
  const updated = Array.isArray(data) ? data[0] : data
  if (!updated || String(updated.id) !== routeId || updated.is_public !== makePublic) throw new Error(t('updateFailed'))
}
