import assert from 'node:assert/strict'
import test from 'node:test'
import { publicationPreview } from '../src/lib/route-publication-model.ts'
import { distanceMeters, extractRoutePoints } from '../src/lib/publication-geometry.ts'

const context = {
  home: { lat: 35, lng: 139 },
  points: [{ lat: 35, lng: 138.98 }, { lat: 35, lng: 139.02 }],
  markers: [{ id: 'home', latitude: 35, longitude: 139 }, { id: 'outside', latitude: 35, longitude: 139.02 }],
  photos: [{ id: 'near', lat: 35, lng: 139, marker_id: null }, { id: 'attached', lat: null, lng: null, marker_id: 'home' }, { id: 'far', lat: 35, lng: 139.02, marker_id: null }],
}

test('500m圏を横断する疎な軌跡も分割し写真とマーカーを隠す', () => {
  const preview = publicationPreview(context, true)
  assert.equal(preview.segments.length, 2)
  for (const point of preview.segments.flat()) assert.ok(distanceMeters(context.home, point) > 500)
  assert.deepEqual(preview.hiddenMarkerIds, ['home'])
  assert.deepEqual(preview.hiddenPhotoIds, ['near', 'attached'])
  assert.ok(preview.publicDistanceM < 2800)
  assert.equal(preview.publicGeoJson.type, 'MultiLineString')
  assert.equal(context.points.length, 2)
})

test('除外オフでは全体を公開し非公開の写真指定を解除する', () => {
  const preview = publicationPreview(context, false)
  assert.equal(preview.segments.length, 1)
  assert.deepEqual(preview.hiddenPhotoIds, [])
  assert.deepEqual(preview.hiddenMarkerIds, [])
  assert.ok(preview.publicDistanceM > 3500)
})

test('全区間がホーム圏内なら公開可能区間は空', () => {
  const preview = publicationPreview({ ...context, points: [context.home, { lat: 35.001, lng: 139 }] }, true)
  assert.equal(preview.segments.length, 0)
  assert.equal(preview.publicDistanceM, 0)
})

test('MultiLineStringの切れ目を公開時につなぎ直さない', () => {
  const points = extractRoutePoints({ geojson: { type: 'MultiLineString', coordinates: [[[139, 36], [139.001, 36]], [[140, 37], [140.001, 37]]] } })
  for (const enabled of [true, false]) {
    const preview = publicationPreview({ ...context, points }, enabled)
    assert.equal(preview.segments.length, 2)
    assert.ok(preview.publicDistanceM < 200)
  }
})
