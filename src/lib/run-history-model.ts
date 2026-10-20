export type RunRow = {
  id: string | number
  name: string
  started_at: string
  ended_at: string
  distance_m: number
  duration_s: number
  geojson: unknown
  polyline: string | null
  elevation_gain_m: number | null
  elevation_loss_m: number | null
  elevation_min_m: number | null
  elevation_max_m: number | null
  elevation_profile: unknown
}

export type RunSummary = {
  id: string
  name: string
  startedAt: string
  endedAt: string
  distanceMeters: number
  durationSeconds: number
  geojson: unknown
  polyline: string | null
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  elevationMinMeters: number | null
  elevationMaxMeters: number | null
  elevationProfile: unknown
  hasPhotos: boolean
}

export type RouteCoordinate = { latitude: number; longitude: number }

export function normalizeRun(row: RunRow, defaultName = '実走'): RunSummary {
  return {
    id: String(row.id),
    name: row.name || defaultName,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    distanceMeters: Number(row.distance_m) || 0,
    durationSeconds: Number(row.duration_s) || 0,
    geojson: row.geojson,
    polyline: row.polyline,
    elevationGainMeters: finiteNumber(row.elevation_gain_m),
    elevationLossMeters: finiteNumber(row.elevation_loss_m),
    elevationMinMeters: finiteNumber(row.elevation_min_m),
    elevationMaxMeters: finiteNumber(row.elevation_max_m),
    elevationProfile: row.elevation_profile,
    hasPhotos: false,
  }
}

function finiteNumber(value: number | null | undefined) {
  const numeric = Number(value)
  return value == null || !Number.isFinite(numeric) ? null : numeric
}

export function coordinatesFromGeoJson(value: unknown): RouteCoordinate[] {
  if (typeof value === 'string') {
    try { return coordinatesFromGeoJson(JSON.parse(value) as unknown) } catch { return [] }
  }
  if (!value || typeof value !== 'object') return []
  const candidate = value as { type?: unknown; coordinates?: unknown; geometry?: unknown }
  if (candidate.type === 'Feature') return coordinatesFromGeoJson(candidate.geometry)
  if (candidate.type !== 'LineString' || !Array.isArray(candidate.coordinates)) return []
  return candidate.coordinates.flatMap((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return []
    const longitude = Number(coordinate[0])
    const latitude = Number(coordinate[1])
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return []
    return [{ latitude, longitude }]
  })
}

export function averageSpeedKmh(distanceMeters: number, durationSeconds: number) {
  return durationSeconds > 0 ? distanceMeters / durationSeconds * 3.6 : 0
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

export function formatRunDate(value: string, locale = 'ja-JP', unknownDate = '日時不明') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return unknownDate
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date)
}
