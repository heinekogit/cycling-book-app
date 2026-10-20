import assert from 'node:assert/strict'
import test from 'node:test'
import { scopedStorageKey } from '../src/lib/storage-scope.ts'

test('走行データは接続先ごとに分離し、旧データを自動取得しない', () => {
  for (const key of ['cycling-book.active-ride.v1', 'cycling-book.pending-rides.v1']) {
    const dev = scopedStorageKey(key, 'https://dev.example.com')
    assert.notEqual(dev, scopedStorageKey(key, 'https://prod.example.com'))
    assert.notEqual(dev, key)
    assert.equal(dev, scopedStorageKey(key, 'https://dev.example.com/'))
  }
})
