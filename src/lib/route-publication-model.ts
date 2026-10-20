import { distanceMeters, filterTrackOutsidePrivacyZone, segmentsToGeoJson, totalDistanceMeters, type TrackPoint } from './publication-geometry.ts'

export type PublicationContext = {
  home: TrackPoint
  points: TrackPoint[]
  photos: { id: string; lat: number | null; lng: number | null; marker_id: string | null }[]
  markers: { id: string; latitude: number; longitude: number }[]
}

export function publicationPreview(context: PublicationContext, filterEnabled: boolean) {
  const segments: TrackPoint[][] = []
  if (filterEnabled) segments.push(...filterTrackOutsidePrivacyZone(context.points, context.home, 500))
  else {
    let segment: TrackPoint[] = []
    for (const point of context.points) {
      if (point.segmentStart) { if (segment.length >= 2) segments.push(segment); segment = [] }
      segment.push(point)
    }
    if (segment.length >= 2) segments.push(segment)
  }
  const hiddenMarkerIds = filterEnabled ? context.markers.filter((marker) => distanceMeters(context.home, { lat: marker.latitude, lng: marker.longitude }) <= 500).map((marker) => String(marker.id)) : []
  const hiddenPhotoIds = filterEnabled ? context.photos.filter((photo) => (photo.marker_id != null && hiddenMarkerIds.includes(String(photo.marker_id))) || (photo.lat != null && photo.lng != null && distanceMeters(context.home, { lat: photo.lat, lng: photo.lng }) <= 500)).map((photo) => String(photo.id)) : []
  return { segments, publicGeoJson: segmentsToGeoJson(segments), publicDistanceM: segments.reduce((sum, segment) => sum + totalDistanceMeters(segment), 0), filterEnabled, hiddenPhotoIds, hiddenMarkerIds }
}
