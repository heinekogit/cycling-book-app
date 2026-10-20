import assert from 'node:assert/strict'
import test from 'node:test'

import { distanceToRouteMeters, routeProgressMeters, splitTrackByRoute } from '../src/lib/route-following.ts'

const route = [{ latitude: 35, longitude: 139 }, { latitude: 35.01, longitude: 139 }]

test('点から予定ルートまでの最短距離を計算する', () => {
  assert.ok(distanceToRouteMeters({ latitude: 35.005, longitude: 139 }, route) < 0.1)
  assert.ok(distanceToRouteMeters({ latitude: 35.005, longitude: 139.001 }, route) > 80)
})

test('30m以内を追従、30m超を逸脱として線分を分割する', () => {
  const track = [
    { latitude: 35.001, longitude: 139 },
    { latitude: 35.002, longitude: 139.0001 },
    { latitude: 35.003, longitude: 139.001 },
    { latitude: 35.004, longitude: 139.0011 },
    { latitude: 35.005, longitude: 139 },
  ]
  const segments = splitTrackByRoute(track, route, 30)
  assert.deepEqual(segments.map((segment) => segment.isOffRoute), [false, true, false])
  assert.deepEqual(segments.map((segment) => segment.coordinates.length), [2, 3, 2])
})

test('予定ルートなしの実走は全体を追従色として扱う', () => {
  const track = [{ latitude: 35, longitude: 139 }, { latitude: 35.001, longitude: 139 }]
  assert.deepEqual(splitTrackByRoute(track, []), [{ isOffRoute: false, coordinates: track }])
})

test('標高図の現在地はルート上の距離に投影し、端点で止まる', () => {
  const total = routeProgressMeters(route[1], route)
  assert.ok(total > 1100 && total < 1120)
  assert.ok(Math.abs(routeProgressMeters({ latitude: 35.005, longitude: 139.001 }, route) - total / 2) < 1)
  assert.equal(routeProgressMeters({ latitude: 34.99, longitude: 139 }, route), 0)
  assert.equal(routeProgressMeters({ latitude: 35.02, longitude: 139 }, route), total)
  assert.equal(routeProgressMeters(route[0], []), null)
  assert.equal(routeProgressMeters(route[0], [route[0]]), null)
})

test('折れ曲がるルートの累積距離と重複点を扱う', () => {
  const bent = [route[0], route[0], route[1], { latitude: 35.01, longitude: 139.01 }]
  const firstLeg = routeProgressMeters(route[1], route)
  const total = routeProgressMeters(bent[3], bent)
  const midpoint = routeProgressMeters({ latitude: 35.01, longitude: 139.005 }, bent)
  assert.ok(Math.abs(midpoint - (firstLeg + (total - firstLeg) / 2)) < 1)
  assert.equal(routeProgressMeters(route[0], [route[0], route[0]]), 0)
})
