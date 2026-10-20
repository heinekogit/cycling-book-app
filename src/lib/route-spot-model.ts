import type { RoutePhoto } from './route-photos'

export type RouteSpot = { id: string; latitude: number | null; longitude: number | null; comment: string; photos: RoutePhoto[]; isPrivacyHidden: boolean }

export type RouteMarkerRow = { id: string | number; latitude: unknown; longitude: unknown; comment: string | null; is_privacy_hidden: boolean }

export function buildRouteSpots(rows: RouteMarkerRow[], photos: RoutePhoto[]) {
  const markers: RouteSpot[] = rows.map((row) => ({
    id: `marker:${row.id}`, latitude: validCoordinate(row.latitude, 90), longitude: validCoordinate(row.longitude, 180),
    comment: String(row.comment || ''), isPrivacyHidden: row.is_privacy_hidden === true,
    photos: photos.filter((photo) => photo.markerId === String(row.id)),
  }))
  const markerIds = new Set(rows.map((row) => String(row.id)))
  const standalone: RouteSpot[] = photos.filter((photo) => !photo.markerId || !markerIds.has(photo.markerId)).map((photo) => ({
    id: `photo:${photo.id}`, latitude: photo.latitude, longitude: photo.longitude, comment: '', photos: [photo], isPrivacyHidden: photo.isPrivacyHidden === true,
  }))
  return { photos, spots: [...markers, ...standalone] }
}

function validCoordinate(value: unknown, limit: number) {
  const number = Number(value)
  return value == null || !Number.isFinite(number) || Math.abs(number) > limit ? null : number
}
