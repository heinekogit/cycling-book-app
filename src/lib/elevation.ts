import { supabase } from '@/lib/supabase'

export type ElevationCoordinate = { latitude: number; longitude: number }
export type StoredElevationProfile = { version: 1; distances_m: number[]; elevations_m: number[] }
export type ElevationProfile = { distances: number[]; elevations: number[]; gain: number; loss: number; minimum: number; maximum: number; averageGrade: number }
export type ElevationRecord = { elevation_profile?: unknown; elevation_gain_m?: number | null; elevation_loss_m?: number | null; elevation_min_m?: number | null; elevation_max_m?: number | null }

const radians = (degrees: number) => degrees * Math.PI / 180
function distance(first: ElevationCoordinate, second: ElevationCoordinate) {
  const latitudeDelta = radians(second.latitude - first.latitude); const longitudeDelta = radians(second.longitude - first.longitude)
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(value))
}

function calculate(points: ElevationCoordinate[], elevations: number[]): ElevationProfile {
  const smoothed = elevations.map((_value, index) => { const slice = elevations.slice(Math.max(0, index - 2), Math.min(elevations.length, index + 3)); return slice.reduce((sum, value) => sum + value, 0) / slice.length })
  const distances = [0]
  for (let index = 1; index < points.length; index += 1) distances.push(distances[index - 1] + distance(points[index - 1], points[index]))
  let gain = 0; let loss = 0
  for (let index = 1; index < smoothed.length; index += 1) { const change = smoothed[index] - smoothed[index - 1]; if (change > .5) gain += change; else if (change < -.5) loss -= change }
  const totalDistance = distances.at(-1) || 0
  return { distances, elevations: smoothed, gain: Math.round(gain), loss: Math.round(loss), minimum: Math.round(Math.min(...smoothed)), maximum: Math.round(Math.max(...smoothed)), averageGrade: totalDistance ? gain / totalDistance * 100 : 0 }
}

export function elevationProfileFromRecord(record: ElevationRecord | null | undefined) {
  const value = record?.elevation_profile as Partial<StoredElevationProfile> | null | undefined
  if (!value || value.version !== 1 || !Array.isArray(value.distances_m) || !Array.isArray(value.elevations_m) || value.distances_m.length < 2 || value.distances_m.length !== value.elevations_m.length) return null
  const distances = value.distances_m.map(Number); const elevations = value.elevations_m.map(Number)
  if (!distances.every(Number.isFinite) || !elevations.every(Number.isFinite)) return null
  let calculatedGain = 0; let calculatedLoss = 0
  for (let index = 1; index < elevations.length; index += 1) { const change = elevations[index] - elevations[index - 1]; if (change > .5) calculatedGain += change; else if (change < -.5) calculatedLoss -= change }
  const gain = record?.elevation_gain_m ?? Math.round(calculatedGain); const loss = record?.elevation_loss_m ?? Math.round(calculatedLoss)
  const minimum = record?.elevation_min_m ?? Math.round(Math.min(...elevations)); const maximum = record?.elevation_max_m ?? Math.round(Math.max(...elevations)); const total = distances.at(-1) || 0
  return { distances, elevations, gain, loss, minimum, maximum, averageGrade: total ? gain / total * 100 : 0 } satisfies ElevationProfile
}

export async function generateElevationProfile(points: ElevationCoordinate[]) {
  if (points.length < 2) return null
  const sampleCount = Math.min(100, points.length); const step = (points.length - 1) / Math.max(1, sampleCount - 1)
  const samples = Array.from({ length: sampleCount }, (_, index) => points[Math.round(index * step)])
  const latitude = samples.map((point) => point.latitude).join(','); const longitude = samples.map((point) => point.longitude).join(',')
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`, { signal: controller.signal })
    if (!response.ok) return null
    const body = await response.json() as { elevation?: unknown }; const sampled = Array.isArray(body.elevation) ? body.elevation.map(Number).filter(Number.isFinite) : []
    if (sampled.length !== samples.length) return null
    const expanded = points.map((_point, index) => { const position = index / step; const left = Math.floor(position); if (left >= sampled.length - 1) return sampled.at(-1)!; const ratio = position - left; return sampled[left] * (1 - ratio) + sampled[left + 1] * ratio })
    return calculate(points, expanded)
  } catch { return null } finally { clearTimeout(timeout) }
}

export async function generateAndSaveRunElevation(runId: string | number, accountId: string, points: ElevationCoordinate[]) {
  const profile = await generateElevationProfile(points)
  if (!profile) return null
  const { error } = await supabase.from('runs').update({ elevation_profile: { version: 1, distances_m: profile.distances, elevations_m: profile.elevations }, elevation_gain_m: profile.gain, elevation_loss_m: profile.loss, elevation_min_m: profile.minimum, elevation_max_m: profile.maximum, elevation_source: 'api', elevation_updated_at: new Date().toISOString() }).eq('id', runId).eq('account_id', accountId)
  if (error) throw error
  return profile
}
