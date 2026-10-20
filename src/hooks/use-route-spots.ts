import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { fetchRouteSpots, type RouteSpot } from '@/lib/route-spots'
import type { RoutePhoto } from '@/lib/route-photos'

export function useRouteSpots(routeId: string | undefined) {
  const [result, setResult] = useState<{ routeId: string; spots: RouteSpot[]; photos: RoutePhoto[] } | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useFocusEffect(useCallback(() => {
    if (!routeId) return
    let active = true
    fetchRouteSpots(routeId).then((data) => {
      if (active) { setResult({ routeId, ...data }); setFailedId(null) }
    }).catch(() => { if (active) { setResult(null); setFailedId(routeId) } })
    return () => { active = false }
  // Changing attempt deliberately starts a fresh request and cancels the previous one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, attempt]))
  return { spots: result && result.routeId === routeId ? result.spots : [], photos: result && result.routeId === routeId ? result.photos : [], failed: !!routeId && failedId === routeId, retry: () => setAttempt((value) => value + 1) }
}
