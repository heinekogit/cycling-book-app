import assert from 'node:assert/strict'
import test from 'node:test'

import { createPendingRide } from '../src/lib/ride-sync-model.ts'

const points = [
  { latitude: 35, longitude: 139, accuracy: 5, timestamp: 1_000 },
  { latitude: 35.001, longitude: 139, accuracy: 5, timestamp: 2_000 },
]

test('終了した走行を固定された送信データへ変換する', () => {
  const ride = { startedAt: 1_000, activeStartedAt: null, elapsedBeforeCurrentMs: 5_000, points, currentPoint: points[1] }
  const pending = createPendingRide(ride, 'user-1', 'Ride', 10_000, 'fixed')
  assert.equal(pending.localId, '7ps-fixed')
  assert.equal(pending.userId, 'user-1')
  assert.equal(pending.startedAt, '1970-01-01T00:00:01.000Z')
  assert.equal(pending.endedAt, '1970-01-01T00:00:10.000Z')
  assert.equal(pending.durationSeconds, 5)
  assert.ok(pending.distanceMeters > 100)
  assert.deepEqual(pending.geojson.coordinates, [[139, 35], [139, 35.001]])
  assert.deepEqual(pending.photos, [])
})

test('撮影した写真と位置情報を実走の同期データへ引き継ぐ', () => {
  const photo = { id: 'photo-1', originalUri: 'file:///original.jpg', thumbnailUri: 'file:///thumb.jpg', takenAt: '2026-09-28T00:00:00.000Z', latitude: 35.1, longitude: 139.1, mimeType: 'image/jpeg', width: 1200, height: 900 }
  const ride = { startedAt: 1_000, activeStartedAt: null, elapsedBeforeCurrentMs: 5_000, points, currentPoint: points[1], photos: [photo] }
  const pending = createPendingRide(ride, 'user-1', 'Ride', 10_000, 'fixed')
  assert.deepEqual(pending.photos, [photo])
})

test('予定ルート付きの走行にroute_idとモードを引き継ぐ', () => {
  const plan = { routeId: '42', routeName: '海沿い', coordinates: [{ latitude: 35, longitude: 139 }] }
  const ride = { startedAt: 1_000, activeStartedAt: null, elapsedBeforeCurrentMs: 5_000, points, currentPoint: points[1], plan }
  const pending = createPendingRide(ride, 'user-1', 'Ride', 10_000, 'fixed')
  assert.equal(pending.routeId, '42')
  assert.equal(pending.mode, 'follow_route')
})
