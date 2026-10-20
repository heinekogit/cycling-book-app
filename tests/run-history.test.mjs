import assert from 'node:assert/strict'
import test from 'node:test'

import {
  averageSpeedKmh,
  coordinatesFromGeoJson,
  formatDuration,
  normalizeRun,
} from '../src/lib/run-history-model.ts'

test('Supabaseの走行行を表示用データへ変換する', () => {
  const run = normalizeRun({
    id: 42,
    name: '朝の実走',
    started_at: '2026-09-05T00:00:00Z',
    ended_at: '2026-09-05T01:00:00Z',
    distance_m: 25_000,
    duration_s: 3_600,
    geojson: null,
    polyline: null,
  })
  assert.equal(run.id, '42')
  assert.equal(run.distanceMeters, 25_000)
  assert.equal(run.durationSeconds, 3_600)
})

test('GeoJSONの経度・緯度を地図座標へ変換し、不正値を除外する', () => {
  const coordinates = coordinatesFromGeoJson({
    type: 'LineString',
    coordinates: [[139.7, 35.6], ['invalid', 35], [181, 35], [139.8, 35.7]],
  })
  assert.deepEqual(coordinates, [
    { latitude: 35.6, longitude: 139.7 },
    { latitude: 35.7, longitude: 139.8 },
  ])
  assert.deepEqual(coordinatesFromGeoJson(JSON.stringify({ type: 'LineString', coordinates: [[139.7, 35.6]] })), [
    { latitude: 35.6, longitude: 139.7 },
  ])
  assert.deepEqual(coordinatesFromGeoJson({ type: 'Point', coordinates: [139, 35] }), [])
})

test('WebのGPX取り込みで保存したFeature形式の軌跡を表示できる', () => {
  const feature = {
    type: 'Feature',
    properties: { trackPoints: [{ lat: 35.6, lng: 139.7 }] },
    geometry: { type: 'LineString', coordinates: [[139.7, 35.6], [139.8, 35.7]] },
  }
  const expected = [
    { latitude: 35.6, longitude: 139.7 },
    { latitude: 35.7, longitude: 139.8 },
  ]
  assert.deepEqual(coordinatesFromGeoJson(feature), expected)
  assert.deepEqual(coordinatesFromGeoJson(JSON.stringify(feature)), expected)
})

test('走行時間と平均速度を表示用に計算する', () => {
  assert.equal(formatDuration(3_661), '01:01:01')
  assert.equal(averageSpeedKmh(10_000, 1_800), 20)
  assert.equal(averageSpeedKmh(10_000, 0), 0)
})
