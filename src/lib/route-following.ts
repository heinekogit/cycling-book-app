export type MapCoordinate = { latitude: number; longitude: number }
export const OFF_ROUTE_THRESHOLD_METERS = 30

const EARTH_RADIUS_METERS = 6_371_000

export function distanceToRouteMeters(point: MapCoordinate, route: MapCoordinate[]) {
  if (route.length === 0) return Number.POSITIVE_INFINITY
  if (route.length === 1) return distanceBetween(point, route[0])
  let nearest = Number.POSITIVE_INFINITY
  for (let index = 1; index < route.length; index += 1) {
    nearest = Math.min(nearest, distanceToSegmentMeters(point, route[index - 1], route[index]))
  }
  return nearest
}

function distanceBetween(first: MapCoordinate, second: MapCoordinate) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value))
}

function distanceToSegmentMeters(point: MapCoordinate, start: MapCoordinate, end: MapCoordinate) {
  return projectOntoSegment(point, start, end).distance
}

function projectOntoSegment(point: MapCoordinate, start: MapCoordinate, end: MapCoordinate) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const referenceLatitude = radians(point.latitude)
  const project = (coordinate: MapCoordinate) => ({
    x: radians(coordinate.longitude - point.longitude) * Math.cos(referenceLatitude) * EARTH_RADIUS_METERS,
    y: radians(coordinate.latitude - point.latitude) * EARTH_RADIUS_METERS,
  })
  const first = project(start); const second = project(end)
  const dx = second.x - first.x; const dy = second.y - first.y
  const lengthSquared = dx * dx + dy * dy
  const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(first.x * dx + first.y * dy) / lengthSquared))
  return { ratio, distance: Math.hypot(first.x + ratio * dx, first.y + ratio * dy) }
}

export type RouteTrackSegment = { isOffRoute: boolean; coordinates: MapCoordinate[] }

export function splitTrackByRoute(track: MapCoordinate[], route: MapCoordinate[], thresholdMeters = OFF_ROUTE_THRESHOLD_METERS): RouteTrackSegment[] {
  if (track.length < 2) return []
  if (route.length < 2) return [{ isOffRoute: false, coordinates: track }]
  const output: RouteTrackSegment[] = []
  let current: RouteTrackSegment | null = null
  for (let index = 1; index < track.length; index += 1) {
    const isOffRoute = distanceToRouteMeters(track[index], route) > thresholdMeters
    if (!current || current.isOffRoute !== isOffRoute) {
      if (current) output.push(current)
      current = { isOffRoute, coordinates: [track[index - 1], track[index]] }
    } else {
      current.coordinates.push(track[index])
    }
  }
  if (current) output.push(current)
  return output
}

// Project GPS onto the route, rather than using ridden distance (which includes detours).
export function routeProgressMeters(point: MapCoordinate, route: MapCoordinate[]): number | null {
  if (route.length < 2) return null
  let nearest = Number.POSITIVE_INFINITY
  let traveled = 0
  let progress = 0
  for (let index = 1; index < route.length; index += 1) {
    const start = route[index - 1]; const end = route[index]
    const length = distanceBetween(start, end)
    const projection = projectOntoSegment(point, start, end)
    if (projection.distance < nearest) {
      nearest = projection.distance
      progress = traveled + length * projection.ratio
    }
    traveled += length
  }
  return progress
}
