import assert from 'node:assert/strict'
import test from 'node:test'
import { visibleRouteDirectionPoints } from '../src/lib/route-direction.ts'
const viewport = { latitude: 35, longitude: 139, latitudeDelta: .04, longitudeDelta: .04, width: 400, height: 300 }
const line = [{ latitude: 35, longitude: 138.98 }, { latitude: 35, longitude: 139.02 }]
test('画面上の矢印は125px間隔で、縮小すると数を減らす', () => {
  const arrows = visibleRouteDirectionPoints(line, viewport)
  assert.equal(arrows.length, 3)
  assert.ok(Math.abs(arrows[1].x - arrows[0].x - 125) < .001)
  assert.ok(visibleRouteDirectionPoints(line, { ...viewport, longitudeDelta: .08, latitudeDelta: .08 }).length < arrows.length)
})
test('往復ルートの矢印を重ねず、画面外には配置しない', () => {
  const arrows = visibleRouteDirectionPoints([...line, line[0]], viewport)
  for (let i = 0; i < arrows.length; i++) {
    assert.ok(arrows[i].x >= 0 && arrows[i].x <= viewport.width)
    for (let j = 0; j < i; j++) assert.ok(Math.hypot(arrows[i].x - arrows[j].x, arrows[i].y - arrows[j].y) >= 80)
  }
  assert.deepEqual(visibleRouteDirectionPoints(line, { ...viewport, latitude: 40 }), [])
  assert.deepEqual(visibleRouteDirectionPoints(line, { ...viewport, width: 0 }), [])
})
