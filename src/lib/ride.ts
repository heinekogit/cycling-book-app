export type TrackPoint = {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

export type RidePhotoDraft = {
  id: string
  originalUri: string
  thumbnailUri: string
  takenAt: string
  latitude: number
  longitude: number
  mimeType: string
  width: number | null
  height: number | null
}

export type RideDraft = {
  startedAt: number
  activeStartedAt: number | null
  elapsedBeforeCurrentMs: number
  points: TrackPoint[]
  currentPoint: TrackPoint | null
  photos?: RidePhotoDraft[]
  plan?: {
    routeId: string
    routeName: string
    coordinates: { latitude: number; longitude: number }[]
  } | null
}

export const MAX_ACCURACY_METERS = 50
export const MIN_MOVE_METERS = 2

const EARTH_RADIUS_METERS = 6_371_000

export function distanceBetween(first: TrackPoint, second: TrackPoint) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const firstLatitude = radians(first.latitude)
  const secondLatitude = radians(second.latitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value))
}

export function totalDistance(points: TrackPoint[]) {
  return points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0)
}

export function appendTrackPoints(draft: RideDraft, candidates: TrackPoint[]) {
  const next = { ...draft, points: [...draft.points] }
  for (const point of candidates) {
    next.currentPoint = point
    if (point.accuracy > MAX_ACCURACY_METERS) continue
    const previous = next.points.at(-1)
    if (previous && distanceBetween(previous, point) < MIN_MOVE_METERS) continue
    next.points.push(point)
  }
  return next
}

export function pauseRideDraft(draft: RideDraft, now = Date.now()): RideDraft {
  return {
    ...draft,
    elapsedBeforeCurrentMs: elapsedMilliseconds(draft, now),
    activeStartedAt: null,
  }
}

export function resumeRideDraft(draft: RideDraft, now = Date.now()): RideDraft {
  return { ...draft, activeStartedAt: now }
}

export function restoreRideDraft(draft: RideDraft, isLocationTaskRunning: boolean, now = Date.now()) {
  if (isLocationTaskRunning || !draft.activeStartedAt) return draft
  return pauseRideDraft(draft, now)
}

export function elapsedMilliseconds(draft: RideDraft, now = Date.now()) {
  return draft.elapsedBeforeCurrentMs + (draft.activeStartedAt !== null ? Math.max(0, now - draft.activeStartedAt) : 0)
}

export function encodePolyline(points: TrackPoint[]) {
  let lastLatitude = 0
  let lastLongitude = 0
  let encoded = ''
  const append = (input: number) => {
    let value = input < 0 ? ~(input << 1) : input << 1
    while (value >= 0x20) {
      encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63)
      value >>= 5
    }
    encoded += String.fromCharCode(value + 63)
  }
  points.forEach((point) => {
    const latitude = Math.round(point.latitude * 1e5)
    const longitude = Math.round(point.longitude * 1e5)
    append(latitude - lastLatitude)
    append(longitude - lastLongitude)
    lastLatitude = latitude
    lastLongitude = longitude
  })
  return encoded
}
