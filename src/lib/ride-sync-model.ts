import { elapsedMilliseconds, encodePolyline, totalDistance, type RideDraft, type RidePhotoDraft } from './ride.ts'

export type PendingRide = {
  localId: string
  userId: string
  name: string
  startedAt: string
  endedAt: string
  distanceMeters: number
  durationSeconds: number
  geojson: { type: 'LineString'; coordinates: [number, number][] }
  polyline: string
  queuedAt: string
  routeId: string | null
  mode: 'follow_route' | 'free'
  photos: RidePhotoDraft[]
}

export function createPendingRide(
  ride: RideDraft,
  userId: string,
  name: string,
  endedAt = Date.now(),
  randomPart = Math.random().toString(36).slice(2),
): PendingRide {
  return {
    localId: `${endedAt.toString(36)}-${randomPart}`,
    userId,
    name,
    startedAt: new Date(ride.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    distanceMeters: Math.round(totalDistance(ride.points)),
    durationSeconds: Math.max(1, Math.round(elapsedMilliseconds(ride, endedAt) / 1000)),
    geojson: { type: 'LineString', coordinates: ride.points.map((point) => [point.longitude, point.latitude]) },
    polyline: encodePolyline(ride.points),
    queuedAt: new Date(endedAt).toISOString(),
    routeId: ride.plan?.routeId ?? null,
    mode: ride.plan?.routeId ? 'follow_route' : 'free',
    photos: ride.photos ?? [],
  }
}
