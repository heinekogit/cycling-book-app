import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import Storage from 'expo-sqlite/kv-store'

import { appendTrackPoints, type RideDraft, type TrackPoint } from '@/lib/ride'
import { RIDE_DRAFT_KEY } from '@/lib/ride-storage'

export const RIDE_LOCATION_TASK = 'cycling-book-ride-location-v1'
type LocationTaskData = { locations: Location.LocationObject[] }

if (!TaskManager.isTaskDefined(RIDE_LOCATION_TASK)) {
  TaskManager.defineTask<LocationTaskData>(RIDE_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return
    await Storage.setItem(RIDE_DRAFT_KEY, (stored) => {
      if (!stored) return stored ?? ''
      try {
        const draft = JSON.parse(stored) as RideDraft
        const points: TrackPoint[] = data.locations.map((location) => ({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 9_999,
            timestamp: location.timestamp,
          }))
        return JSON.stringify(appendTrackPoints(draft, points))
      } catch {
        return stored
      }
    })
  })
}
