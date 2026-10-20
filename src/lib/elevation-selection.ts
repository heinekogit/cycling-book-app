import type { ElevationProfile } from './elevation'
import { routeDistanceMeters, type RouteCoordinate } from './saved-route-model.ts'

export function elevationAtDistance(profile: ElevationProfile, distance: number) {
  const target = Math.max(0, Math.min(profile.distances.at(-1) ?? 0, distance))
  for (let i = 1; i < profile.distances.length; i++) {
    if (profile.distances[i] < target) continue
    const span = profile.distances[i] - profile.distances[i - 1]
    const fraction = span > 0 ? (target - profile.distances[i - 1]) / span : 0
    return profile.elevations[i - 1] + fraction * (profile.elevations[i] - profile.elevations[i - 1])
  }
  return profile.elevations.at(-1) ?? 0
}

// Signed average grade over a 100 m window, shortened at route endpoints.
export function elevationSelection(profile: ElevationProfile, fraction: number) {
  const total = profile.distances.at(-1) ?? 0
  const distance = Math.max(0, Math.min(1, fraction)) * total
  const start = Math.max(0, distance - 50); const end = Math.min(total, distance + 50)
  return { distance, elevation: elevationAtDistance(profile, distance), grade: end > start ? (elevationAtDistance(profile, end) - elevationAtDistance(profile, start)) / (end - start) * 100 : null }
}

export function coordinateAtFraction(points: RouteCoordinate[], fraction: number) {
  if (!points.length) return null
  if (fraction <= 0) return points[0]
  if (fraction >= 1) return points.at(-1)!
  const target = routeDistanceMeters(points) * Math.max(0, Math.min(1, fraction))
  let traveled = 0
  for (let i = 1; i < points.length; i++) {
    const length = routeDistanceMeters([points[i - 1], points[i]])
    if (length > 0 && traveled + length >= target) {
      const ratio = (target - traveled) / length
      return { latitude: points[i - 1].latitude + ratio * (points[i].latitude - points[i - 1].latitude), longitude: points[i - 1].longitude + ratio * (points[i].longitude - points[i - 1].longitude) }
    }
    traveled += length
  }
  return points.at(-1)!
}
