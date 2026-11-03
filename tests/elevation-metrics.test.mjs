import assert from 'node:assert/strict'
import test from 'node:test'
import { elevationChangeMeters } from '../src/lib/elevation-metrics.ts'

test('gradual climb is counted independently of profile point density', () => {
  const elevations = Array.from({ length: 101 }, (_, index) => index / 10)
  assert.deepEqual(elevationChangeMeters(elevations), { gain: 10, loss: 0 })
})

test('ascent and descent use meaningful reversals, not every small fluctuation', () => {
  const elevations = [0, 0.4, 0.8, 1.2, 2, 3, 4, 3.8, 3, 2, 1, 2, 3, 4, 5]
  assert.deepEqual(elevationChangeMeters(elevations), { gain: 8, loss: 3 })
  assert.deepEqual(elevationChangeMeters([0, 0.3, 0.1, 0.4, 0]), { gain: 0, loss: 0 })
})
