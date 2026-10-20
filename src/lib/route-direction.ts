import type { RouteCoordinate } from './saved-route-model'

export type RouteDirectionPoint = RouteCoordinate & { rotation: number }

function distanceMeters(first: RouteCoordinate, second: RouteCoordinate) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(value))
}

function screenRotation(first: RouteCoordinate, second: RouteCoordinate) {
  const averageLatitude = (first.latitude + second.latitude) / 2 * Math.PI / 180
  const horizontal = (second.longitude - first.longitude) * Math.cos(averageLatitude)
  const vertical = -(second.latitude - first.latitude)
  return Math.atan2(vertical, horizontal) * 180 / Math.PI
}

export function routeDirectionPoints(points: RouteCoordinate[]) {
  if (points.length < 2) return []
  const segmentLengths = points.slice(1).map((point, index) => distanceMeters(points[index], point))
  const totalDistance = segmentLengths.reduce((sum, distance) => sum + distance, 0)
  if (totalDistance < 25) return []
  const spacing = Math.max(100, Math.min(500, totalDistance / 7))
  const arrows: RouteDirectionPoint[] = []
  let travelled = 0
  let nextDistance = Math.min(spacing * .65, totalDistance / 2)

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index]
    if (length < .5) continue
    const first = points[index]
    const second = points[index + 1]
    while (nextDistance <= travelled + length) {
      const ratio = (nextDistance - travelled) / length
      arrows.push({
        latitude: first.latitude + (second.latitude - first.latitude) * ratio,
        longitude: first.longitude + (second.longitude - first.longitude) * ratio,
        rotation: screenRotation(first, second),
      })
      nextDistance += spacing
    }
    travelled += length
  }
  return arrows
}

export type DirectionViewport = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number; width: number; height: number }

// Use the visible map's Mercator bounds so zooming out reduces arrow density.
export function visibleRouteDirectionPoints(points: RouteCoordinate[], viewport: DirectionViewport) {
  if (points.length < 2 || viewport.width <= 0 || viewport.height <= 0 || viewport.longitudeDelta <= 0 || viewport.latitudeDelta <= 0) return []
  const mercator = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, latitude)) * Math.PI / 360))
  const north = mercator(viewport.latitude + viewport.latitudeDelta / 2)
  const south = mercator(viewport.latitude - viewport.latitudeDelta / 2)
  if (north <= south) return []
  const project = (point: RouteCoordinate) => ({
    x: (((point.longitude - viewport.longitude + 540) % 360 - 180) / viewport.longitudeDelta + .5) * viewport.width,
    y: (north - mercator(point.latitude)) / (north - south) * viewport.height,
  })
  const spacing = 125
  const arrows: (RouteDirectionPoint & { x: number; y: number })[] = []
  let traveled = 0
  for (let i = 1; i < points.length; i++) {
    const first = project(points[i - 1]); const second = project(points[i])
    const dx = second.x - first.x; const dy = second.y - first.y
    const length = Math.hypot(dx, dy)
    if (length < .001) continue
    // Clip candidates to the viewport before iterating, even on very long segments.
    let low = 0; let high = 1
    for (const [origin, delta, maximum] of [[first.x, dx, viewport.width], [first.y, dy, viewport.height]]) {
      if (Math.abs(delta) < 1e-9) { if (origin < 0 || origin > maximum) high = -1; continue }
      const a = -origin / delta; const b = (maximum - origin) / delta
      low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b))
    }
    const offset = spacing * .65
    let candidate = Math.max(0, Math.ceil((traveled + low * length - offset) / spacing)) * spacing + offset
    while (high >= low && candidate <= traveled + high * length && arrows.length < 80) {
      const ratio = (candidate - traveled) / length
      const x = first.x + dx * ratio; const y = first.y + dy * ratio
      if (arrows.every((arrow) => Math.hypot(arrow.x - x, arrow.y - y) >= 80)) {
        const latitude = (2 * Math.atan(Math.exp(north - y / viewport.height * (north - south))) - Math.PI / 2) * 180 / Math.PI
        arrows.push({ latitude, longitude: points[i - 1].longitude + (points[i].longitude - points[i - 1].longitude) * ratio, rotation: Math.atan2(dy, dx) * 180 / Math.PI, x, y })
      }
      candidate += spacing
    }
    traveled += length
  }
  return arrows
}
