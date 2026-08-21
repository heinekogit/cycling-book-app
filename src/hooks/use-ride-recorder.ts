import type { Session } from '@supabase/supabase-js'
import * as Location from 'expo-location'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { RIDE_LOCATION_TASK } from '@/background-location'
import { ensureRideLocationPermissions, type LocationPermissionIssue } from '@/lib/location-permissions'
import {
  encodePolyline,
  elapsedMilliseconds,
  pauseRideDraft,
  restoreRideDraft,
  resumeRideDraft,
  totalDistance,
  type RideDraft,
} from '@/lib/ride'
import { clearRideDraft, createRideDraft, loadRideDraft, saveRideDraft } from '@/lib/ride-storage'
import { supabase } from '@/lib/supabase'

export type RideState = 'ready' | 'locating' | 'riding' | 'paused' | 'finished' | 'saving'

export function useRideRecorder(session: Session | null) {
  const [rideState, setRideState] = useState<RideState>('ready')
  const [draft, setDraft] = useState<RideDraft | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [speedKmh, setSpeedKmh] = useState(0)
  const [message, setMessage] = useState('開始するとバックグラウンド記録を始めます')
  const [hasUnsavedRide, setHasUnsavedRide] = useState(false)
  const [permissionIssue, setPermissionIssue] = useState<LocationPermissionIssue | null>(null)

  const distanceMeters = useMemo(() => totalDistance(draft?.points ?? []), [draft?.points])

  const applyDraft = useCallback((nextDraft: RideDraft) => {
    setDraft(nextDraft)
    setElapsedSeconds(Math.floor(elapsedMilliseconds(nextDraft) / 1000))
    const last = nextDraft.points.at(-1)
    const previous = nextDraft.points.at(-2)
    if (!last || !previous) return
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
      setMessage(isRunning ? 'バックグラウンドGPS記録中' : '端末内に未保存の実走記録があります')
    })
    return () => { mounted = false }
  }, [applyDraft])

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

  const beginBackgroundUpdates = async () => {
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
        notificationTitle: 'Cycling Bookで走行記録中',
        notificationBody: 'バックグラウンドで位置情報を記録しています',
        killServiceOnDestroy: false,
      },
    })
  }

  const start = useCallback(async (discardExisting = false) => {
    setRideState('locating')
    setPermissionIssue(null)
    setMessage('位置情報の許可を確認しています…')
    try {
      const permission = await ensureRideLocationPermissions()
      if (!permission.granted) {
        setPermissionIssue(permission.issue)
        setMessage(permission.message)
        setRideState(hasUnsavedRide ? 'paused' : 'ready')
        return
      }
      if (discardExisting) {
        await stopUpdates()
        await clearRideDraft()
      }
      const stored = discardExisting ? null : await loadRideDraft()
      const nextDraft = stored ? resumeRideDraft(stored) : createRideDraft()
      await saveRideDraft(nextDraft)
      applyDraft(nextDraft)
      setHasUnsavedRide(true)
      await beginBackgroundUpdates()
      setRideState('riding')
      setMessage('バックグラウンドGPS記録中')
    } catch (error) {
      setRideState(hasUnsavedRide ? 'paused' : 'ready')
      setMessage(error instanceof Error ? error.message : '位置情報を開始できませんでした')
    }
  }, [applyDraft, hasUnsavedRide, stopUpdates])

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
      setMessage('記録を一時停止しています')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '一時停止できませんでした')
    }
  }, [applyDraft, stopUpdates])

  const getAccountId = useCallback(async () => {
    if (!session?.user.id) return null
    const { data, error } = await supabase.from('users').select('account_id').eq('id', session.user.id).maybeSingle()
    if (error) throw error
    return data?.account_id ?? null
  }, [session])

  const saveRun = useCallback(async (ride: RideDraft) => {
    if (ride.points.length < 2) throw new Error('保存に必要な位置情報が不足しています')
    const accountId = await getAccountId()
    if (!accountId) throw new Error('アカウント情報を確認できません')
    const endedAt = Date.now()
    const date = new Date(endedAt)
    const name = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} 実走`
    const { error } = await supabase.from('runs').insert({
      account_id: accountId,
      name,
      started_at: new Date(ride.startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      distance_m: Math.round(totalDistance(ride.points)),
      duration_s: Math.max(1, Math.round(elapsedMilliseconds(ride, endedAt) / 1000)),
      geojson: { type: 'LineString', coordinates: ride.points.map((point) => [point.longitude, point.latitude]) },
      polyline: encodePolyline(ride.points),
    })
    if (error) throw error
  }, [getAccountId])

  const finishAndSave = useCallback(async () => {
    setRideState('saving')
    setMessage('実走ログを保存しています…')
    try {
      await stopUpdates()
      const stored = await loadRideDraft()
      if (!stored) throw new Error('端末内の走行データが見つかりません')
      const finished = pauseRideDraft(stored)
      await saveRideDraft(finished)
      applyDraft(finished)
      await saveRun(finished)
      await clearRideDraft()
      setHasUnsavedRide(false)
      setRideState('finished')
      setSpeedKmh(0)
      setMessage('実走ログをSupabaseへ保存しました')
    } catch (error) {
      setHasUnsavedRide(true)
      setRideState('finished')
      setMessage(`保存できませんでした。端末内データは保持しています：${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }, [applyDraft, saveRun, stopUpdates])

  const resetFinishedRide = useCallback(() => {
    setDraft(null)
    setElapsedSeconds(0)
    setSpeedKmh(0)
    setRideState('ready')
    setMessage('開始するとバックグラウンド記録を始めます')
  }, [])

  return {
    rideState,
    draft,
    elapsedSeconds,
    speedKmh,
    distanceMeters,
    message,
    hasUnsavedRide,
    permissionIssue,
    start,
    pause,
    finishAndSave,
    resetFinishedRide,
  }
}
