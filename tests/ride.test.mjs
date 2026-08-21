import assert from 'node:assert/strict'
import test from 'node:test'

import {
  appendTrackPoints,
  distanceBetween,
  elapsedMilliseconds,
  encodePolyline,
  pauseRideDraft,
  restoreRideDraft,
  resumeRideDraft,
  totalDistance,
} from '../src/lib/ride.ts'

const point = (latitude, longitude, timestamp, accuracy = 5) => ({ latitude, longitude, timestamp, accuracy })
const draft = (overrides = {}) => ({
  startedAt: 1_000,
  activeStartedAt: 1_000,
  elapsedBeforeCurrentMs: 0,
  points: [],
  currentPoint: null,
  ...overrides,
})

test('距離をメートル単位で計算する', () => {
  const first = point(35.681236, 139.767125, 1_000)
  const second = point(35.682236, 139.767125, 2_000)
  assert.ok(Math.abs(distanceBetween(first, second) - 111.2) < 0.5)
  assert.equal(totalDistance([first]), 0)
})

test('精度の低い点と2m未満の移動を軌跡から除外する', () => {
  const first = point(35, 139, 1_000)
  const inaccurate = point(35.001, 139, 2_000, 80)
  const tooClose = point(35.00001, 139, 3_000)
  const moved = point(35.0001, 139, 4_000)
  const result = appendTrackPoints(draft(), [first, inaccurate, tooClose, moved])
  assert.deepEqual(result.points, [first, moved])
  assert.equal(result.currentPoint, moved)
})

test('一時停止中の時間を除外し、再開後だけ加算する', () => {
  const riding = draft({ elapsedBeforeCurrentMs: 2_000, activeStartedAt: 10_000 })
  assert.equal(elapsedMilliseconds(riding, 15_000), 7_000)
  const paused = pauseRideDraft(riding, 15_000)
  assert.equal(paused.activeStartedAt, null)
  assert.equal(elapsedMilliseconds(paused, 30_000), 7_000)
  const resumed = resumeRideDraft(paused, 30_000)
  assert.equal(elapsedMilliseconds(resumed, 33_000), 10_000)
})

test('バックグラウンドタスクが停止していた記録を一時停止状態で復元する', () => {
  const stored = draft({ elapsedBeforeCurrentMs: 2_000, activeStartedAt: 10_000 })
  const restored = restoreRideDraft(stored, false, 15_000)
  assert.equal(restored.activeStartedAt, null)
  assert.equal(restored.elapsedBeforeCurrentMs, 7_000)
  assert.equal(restoreRideDraft(stored, true, 15_000), stored)
})

test('Google Polyline形式へエンコードする', () => {
  const points = [point(38.5, -120.2, 1_000), point(40.7, -120.95, 2_000), point(43.252, -126.453, 3_000)]
  assert.equal(encodePolyline(points), '_p~iF~ps|U_ulLnnqC_mqNvxq`@')
})
