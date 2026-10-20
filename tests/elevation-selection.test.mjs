import assert from 'node:assert/strict'
import test from 'node:test'
import { elevationSelection, coordinateAtFraction } from '../src/lib/elevation-selection.ts'
const profile = { distances: [0, 100, 200], elevations: [0, 10, 0] }
test('前後50mの勾配と補間標高を計算する', () => {
  assert.deepEqual(elevationSelection(profile, 0.25), { distance: 50, elevation: 5, grade: 10 })
  assert.equal(elevationSelection(profile, 0.75).grade, -10)
  assert.equal(elevationSelection(profile, 0.5).grade, 0)
})
test('端点では計算区間を短縮しゼロ距離では勾配なし', () => {
  assert.equal(elevationSelection(profile, -1).grade, 10)
  assert.equal(elevationSelection(profile, 2).grade, -10)
  assert.equal(elevationSelection({ distances: [0, 0], elevations: [1, 1] }, 0).grade, null)
})
test('地点は点数でなく経路の累積距離で補間する', () => {
  const points = [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 }, { latitude: 0, longitude: 0.01 }]
  assert.ok(Math.abs(coordinateAtFraction(points, 0.5).longitude - 0.005) < 1e-9)
  assert.deepEqual(coordinateAtFraction(points, 1), points[2])
  assert.equal(coordinateAtFraction([], 0), null)
})
