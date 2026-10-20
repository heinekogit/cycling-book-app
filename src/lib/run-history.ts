import { normalizeRun, type RunRow } from '@/lib/run-history-model'
import { supabase } from '@/lib/supabase'
import type { TFunction } from '@/i18n'
import { fetchDirectRunPhotos, fetchRoutePhotos, type RoutePhoto } from '@/lib/route-photos'
import { generateAndSaveRunElevation, type ElevationCoordinate, type ElevationProfile } from '@/lib/elevation'

const RUN_COLUMNS = 'id,name,started_at,ended_at,distance_m,duration_s,geojson,polyline,elevation_gain_m,elevation_loss_m,elevation_min_m,elevation_max_m,elevation_profile'

async function getAccountId(userId: string, t: TFunction) {
  const { data, error } = await supabase.from('users').select('account_id').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!data?.account_id) throw new Error(t('accountUnavailable'))
  return data.account_id
}

export async function fetchRuns(userId: string, t: TFunction) {
  const accountId = await getAccountId(userId, t)
  const { data, error } = await supabase
    .from('runs')
    .select(RUN_COLUMNS)
    .eq('account_id', accountId)
    .order('started_at', { ascending: false })
  if (error) throw error
  const runs = ((data ?? []) as RunRow[]).map((row) => normalizeRun(row, t('defaultRunName')))
  if (runs.length === 0) return runs

  const { data: directPhotos, error: directPhotoError } = await supabase.from('run_photos').select('run_id').in('run_id', runs.map((run) => run.id))
  if (directPhotoError) throw directPhotoError
  const directRunIdsWithPhotos = new Set((directPhotos ?? []).map((photo) => String(photo.run_id)))

  const { data: routes, error: routeError } = await supabase
    .from('routes')
    .select('id,source_run_id,created_at,route_type')
    .eq('account_id', accountId)
  if (routeError) throw routeError
  const routeIds = (routes ?? []).map((route) => route.id)
  if (routeIds.length === 0) return runs.map((run) => ({ ...run, hasPhotos: directRunIdsWithPhotos.has(run.id) }))

  const { data: photos, error: photoError } = await supabase
    .from('route_spot_photos')
    .select('route_id')
    .in('route_id', routeIds)
  if (photoError) throw photoError

  const runIdByRouteId = new Map<string, string>()
  for (const route of routes ?? []) {
    if (route.source_run_id != null) {
      runIdByRouteId.set(String(route.id), String(route.source_run_id))
      continue
    }
    if (route.route_type !== 'from_run') continue
    const routeTime = new Date(route.created_at).getTime()
    if (!Number.isFinite(routeTime)) continue
    let closest: { id: string; difference: number } | null = null
    for (const run of runs) {
      const difference = Math.abs(routeTime - new Date(run.startedAt).getTime())
      if (Number.isFinite(difference) && (!closest || difference < closest.difference)) closest = { id: run.id, difference }
    }
    if (closest && closest.difference <= 6 * 60 * 60 * 1000) runIdByRouteId.set(String(route.id), closest.id)
  }
  const runIdsWithPhotos = new Set((photos ?? []).flatMap((photo) => {
    const runId = runIdByRouteId.get(String(photo.route_id))
    return runId ? [runId] : []
  }))
  return runs.map((run) => ({ ...run, hasPhotos: directRunIdsWithPhotos.has(run.id) || runIdsWithPhotos.has(run.id) }))
}

export async function fetchRun(userId: string, runId: string, t: TFunction) {
  const accountId = await getAccountId(userId, t)
  const { data, error } = await supabase
    .from('runs')
    .select(RUN_COLUMNS)
    .eq('account_id', accountId)
    .eq('id', runId)
    .maybeSingle()
  if (error) throw error
  return data ? normalizeRun(data as RunRow, t('defaultRunName')) : null
}

export async function fetchRunPhotos(userId: string, runId: string, startedAt: string, t: TFunction): Promise<RoutePhoto[]> {
  const accountId = await getAccountId(userId, t)
  const directPhotos = await fetchDirectRunPhotos(runId)
  if (directPhotos.length > 0) return directPhotos
  const { data: related, error: relatedError } = await supabase.from('routes').select('id').eq('account_id', accountId).eq('source_run_id', runId).order('id', { ascending: false }).limit(1).maybeSingle()
  if (relatedError) throw relatedError
  if (related?.id != null) return fetchRoutePhotos(String(related.id))
  const { data: legacy, error: legacyError } = await supabase.from('routes').select('id,created_at').eq('account_id', accountId).eq('route_type', 'from_run').is('source_run_id', null).order('created_at', { ascending: false }).limit(20)
  if (legacyError) throw legacyError
  const runTime = new Date(startedAt).getTime()
  const closest = (legacy ?? []).reduce<{ id: string | number; difference: number } | null>((best, route) => {
    const difference = Math.abs(new Date(route.created_at).getTime() - runTime)
    return !Number.isFinite(difference) || (best && best.difference <= difference) ? best : { id: route.id, difference }
  }, null)
  return closest && closest.difference <= 6 * 60 * 60 * 1000 ? fetchRoutePhotos(String(closest.id)) : []
}

export async function generateMissingRunElevation(userId: string, runId: string, points: ElevationCoordinate[], t: TFunction): Promise<ElevationProfile | null> {
  const accountId = await getAccountId(userId, t)
  return generateAndSaveRunElevation(runId, accountId, points)
}
