import { fetchRoutePhotos } from '@/lib/route-photos'
import { supabase } from '@/lib/supabase'

import { buildRouteSpots } from './route-spot-model'
export type { RouteSpot } from './route-spot-model'

export async function fetchRouteSpots(routeId: string) {
  const [photos, result] = await Promise.all([
    fetchRoutePhotos(routeId),
    supabase.from('route_markers').select('id,latitude,longitude,comment,is_privacy_hidden').eq('route_id', routeId).order('sort_order'),
  ])
  if (result.error) throw result.error
  return buildRouteSpots(result.data ?? [], photos)
}
