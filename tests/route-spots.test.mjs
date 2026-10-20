import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRouteSpots } from '../src/lib/route-spot-model.ts'
const photo = (id, markerId) => ({ id, markerId, latitude: 35, longitude: 139, imageUrl: 'test', thumbUrl: null, takenAt: null })
test('マーカーの写真を保存順にまとめ、通常写真のピンと重複させない', () => {
  const photos = [photo('second', '1'), photo('first', '1'), photo('standalone', null)]
  const result = buildRouteSpots([{ id: 1, latitude: 35, longitude: 139, comment: '休憩所', is_privacy_hidden: true }], photos)
  assert.equal(result.spots.length, 2)
  assert.equal(result.spots[0].comment, '休憩所')
  assert.equal(result.spots[0].isPrivacyHidden, true)
  assert.deepEqual(result.spots[0].photos.map((p) => p.id), ['second', 'first'])
  assert.equal(result.spots[1].id, 'photo:standalone')
})
test('座標なしのマーカーも一覧用に残し、存在しないマーカーの写真も失わない', () => {
  const result = buildRouteSpots([{ id: 'bad', latitude: null, longitude: 200, comment: null, is_privacy_hidden: false }], [photo('orphan', 'missing')])
  assert.equal(result.spots[0].latitude, null)
  assert.equal(result.spots[0].longitude, null)
  assert.equal(result.spots[1].id, 'photo:orphan')
})
