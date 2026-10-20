import type { Session } from '@supabase/supabase-js'
import * as Location from 'expo-location'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'

import { RIDE_LOCATION_TASK } from '@/background-location'
import { ensureRideLocationPermissions, type LocationPermissionIssue } from '@/lib/location-permissions'
import {
  elapsedMilliseconds,
  pauseRideDraft,
  restoreRideDraft,
  resumeRideDraft,
  totalDistance,
  type RideDraft,
  type RidePhotoDraft,
} from '@/lib/ride'
import { appendRidePhoto, clearRideDraft, createRideDraft, loadRideDraft, saveRideDraft } from '@/lib/ride-storage'
import { useI18n } from '@/i18n'
import { createPendingRide } from '@/lib/ride-sync-model'
import { enqueuePendingRide, pendingRideCount, syncPendingRides } from '@/lib/ride-sync'
import { removeRidePhotoFiles } from '@/lib/ride-photo-capture'

export type RideState = 'ready' | 'locating' | 'riding' | 'paused' | 'finished' | 'saving'

export function useRideRecorder(session: Session | null, plan: RideDraft['plan'] = null) {
  const { t } = useI18n()
  const userId = session?.user.id
  const [rideState, setRideState] = useState<RideState>('ready')
  const [draft, setDraft] = useState<RideDraft | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [speedKmh, setSpeedKmh] = useState(0)
  const [message, setMessage] = useState(() => t('readyMessage'))
  const [hasUnsavedRide, setHasUnsavedRide] = useState(false)
  const [permissionIssue, setPermissionIssue] = useState<LocationPermissionIssue | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const distanceMeters = useMemo(() => totalDistance(draft?.points ?? []), [draft?.points])

  const applyDraft = useCallback((nextDraft: RideDraft) => {
    setDraft(nextDraft)
    setElapsedSeconds(Math.floor(elapsedMilliseconds(nextDraft) / 1000))
    const last = nextDraft.points.at(-1)
    const previous = nextDraft.points.at(-2)
    if (!last || !previous || Date.now() - last.timestamp > 5_000) {
      setSpeedKmh(0)
      return
    }
    const seconds = (last.timestamp - previous.timestamp) / 1000
    const segmentDistance = totalDistance([previous, last])
    setSpeedKmh(seconds > 0 && seconds < 30 ? segmentDistance / seconds * 3.6 : 0)
  }, [])

  const refreshDraft = useCallback(async () => {
    const stored = await loadRideDraft()
    if (stored) applyDraft(stored)
  }, [applyDraft])

  useEffect(() => {
    let mounted = true
    Promise.all([loadRideDraft(), Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK)]).then(async ([stored, isRunning]) => {
      if (!mounted || !stored) return
      const restored = restoreRideDraft(stored, isRunning)
      if (restored !== stored) await saveRideDraft(restored)
      applyDraft(restored)
      setHasUnsavedRide(true)
      setRideState(isRunning ? 'riding' : 'paused')
      setMessage(isRunning ? t('recordingMessage') : t('unsavedMessage'))
    })
    return () => { mounted = false }
  }, [applyDraft, t])

  const syncNow = useCallback(async (showResult = true) => {
    if (!userId) return
    setIsSyncing(true)
    const result = await syncPendingRides(userId)
    setPendingCount(result.pending)
    setIsSyncing(false)
    if (!showResult) return
    if (result.error) setMessage(t('syncFailed'))
    else if (result.synced > 0) setMessage(t('syncComplete', { count: result.synced }))
  }, [t, userId])

  useEffect(() => {
    if (!userId) return
    let active = true
    const refreshAndSync = async () => {
      const count = await pendingRideCount(userId)
      if (active) setPendingCount(count)
      if (count > 0 && active) await syncNow(false)
    }
    void refreshAndSync()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAndSync()
    })
    return () => { active = false; subscription.remove() }
  }, [syncNow, userId])

  useEffect(() => {
    if (!['riding', 'locating'].includes(rideState)) return
    const timer = setInterval(refreshDraft, 1000)
    return () => clearInterval(timer)
  }, [refreshDraft, rideState])

  const stopUpdates = useCallback(async () => {
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(RIDE_LOCATION_TASK)
    }
  }, [])

  const beginBackgroundUpdates = useCallback(async () => {
    await Location.startLocationUpdatesAsync(RIDE_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      activityType: Location.ActivityType.Fitness,
      distanceInterval: 2,
      timeInterval: 1000,
      deferredUpdatesDistance: 0,
      deferredUpdatesInterval: 1000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: t('notificationTitle'),
        notificationBody: t('notificationBody'),
        killServiceOnDestroy: false,
      },
    })
  }, [t])

  const start = useCallback(async (discardExisting = false) => {
    setRideState('locating')
    setPermissionIssue(null)
    setMessage(t('checkingPermission'))
    try {
      const permission = await ensureRideLocationPermissions(t)
      if (!permission.granted) {
        setPermissionIssue(permission.issue)
        setMessage(permission.message)
        setRideState(hasUnsavedRide ? 'paused' : 'ready')
        return
      }
      if (discardExisting) {
        await stopUpdates()
        const discarded = await loadRideDraft()
        await clearRideDraft()
        await removeRidePhotoFiles(discarded?.photos)
      }
      const stored = discardExisting ? null : await loadRideDraft()
      const nextDraft = stored ? resumeRideDraft(stored) : createRideDraft(plan)
      await saveRideDraft(nextDraft)
      applyDraft(nextDraft)
      setHasUnsavedRide(true)
      await beginBackgroundUpdates()
      setRideState('riding')
      setMessage(t('recordingMessage'))
    } catch (error) {
      setRideState(hasUnsavedRide ? 'paused' : 'ready')
      setMessage(error instanceof Error ? error.message : t('startLocationFailed'))
    }
  }, [applyDraft, beginBackgroundUpdates, hasUnsavedRide, plan, stopUpdates, t])

  const pause = useCallback(async () => {
    try {
      await stopUpdates()
      const stored = await loadRideDraft()
      if (stored) {
        const paused = pauseRideDraft(stored)
        await saveRideDraft(paused)
        applyDraft(paused)
      }
      setSpeedKmh(0)
      setRideState('paused')
      setMessage(t('pausedMessage'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('pauseFailed'))
    }
  }, [applyDraft, stopUpdates, t])

  const queueRun = useCallback(async (ride: RideDraft, name: string) => {
    if (ride.points.length < 2) throw new Error(t('insufficientPoints'))
    if (!userId) throw new Error(t('accountUnavailable'))
    const endedAt = Date.now()
    await enqueuePendingRide(createPendingRide(ride, userId, name, endedAt))
  }, [t, userId])

  const finishAndSave = useCallback(async (name: string) => {
    setRideState('saving')
    setMessage(t('savingMessage'))
    try {
      await stopUpdates()
      const stored = await loadRideDraft()
      if (!stored) throw new Error(t('localRideMissing'))
      const finished = pauseRideDraft(stored)
      await saveRideDraft(finished)
      applyDraft(finished)
      await queueRun(finished, name)
      await clearRideDraft()
      setHasUnsavedRide(false)
      setRideState('finished')
      setSpeedKmh(0)
      setIsSyncing(true)
      if (userId) await syncPendingRides(userId)
      const remaining = await pendingRideCount(userId ?? '')
      setPendingCount(remaining)
      setIsSyncing(false)
      setMessage(remaining > 0 ? t('queuedMessage') : t('syncedMessage'))
    } catch (error) {
      setIsSyncing(false)
      setHasUnsavedRide(true)
      setRideState('finished')
      setMessage(t('saveFailed', { error: error instanceof Error ? error.message : t('unknownError') }))
    }
  }, [applyDraft, queueRun, stopUpdates, t, userId])

  const addPhoto = useCallback(async (photo: RidePhotoDraft) => {
    const updated = await appendRidePhoto(photo)
    if (!updated) throw new Error(t('localRideMissing'))
    applyDraft(updated)
  }, [applyDraft, t])

  const discardRide = useCallback(async () => {
    try {
      await stopUpdates()
      const stored = await loadRideDraft()
      await clearRideDraft()
      await removeRidePhotoFiles(stored?.photos)
      setDraft(null)
      setElapsedSeconds(0)
      setSpeedKmh(0)
      setHasUnsavedRide(false)
      setRideState('ready')
      setMessage(t('readyMessage'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('discardFailed'))
    }
  }, [stopUpdates, t])

  const resetFinishedRide = useCallback(() => {
    setDraft(null)
    setElapsedSeconds(0)
    setSpeedKmh(0)
    setRideState('ready')
    setMessage(t('readyMessage'))
  }, [t])

  return {
    rideState,
    draft,
    elapsedSeconds,
    speedKmh,
    distanceMeters,
    message,
    hasUnsavedRide,
    permissionIssue,
    pendingCount,
    isSyncing,
    syncNow,
    start,
    pause,
    finishAndSave,
    addPhoto,
    discardRide,
    resetFinishedRide,
  }
}
