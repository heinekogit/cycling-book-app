import * as Crypto from 'expo-crypto'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'

import type { RidePhotoDraft, TrackPoint } from '@/lib/ride'

const PHOTO_DIRECTORY = `${FileSystem.documentDirectory}ride-photos`

function extensionFor(asset: ImagePicker.ImagePickerAsset) {
  const fromName = asset.fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase()
  if (fromName && ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(fromName)) return fromName
  if (asset.mimeType === 'image/png') return 'png'
  if (asset.mimeType === 'image/heic') return 'heic'
  if (asset.mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

export async function captureRidePhoto(point: TrackPoint): Promise<RidePhotoDraft | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) throw new Error('camera-permission')
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false })
  if (result.canceled || !result.assets[0]) return null
  const asset = result.assets[0]
  const id = Crypto.randomUUID()
  const extension = extensionFor(asset)
  await FileSystem.makeDirectoryAsync(PHOTO_DIRECTORY, { intermediates: true })
  const originalUri = `${PHOTO_DIRECTORY}/${id}.${extension}`
  const thumbnailUri = `${PHOTO_DIRECTORY}/${id}-thumb.jpg`
  try {
    await FileSystem.copyAsync({ from: asset.uri, to: originalUri })
    const thumbnail = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 480 } }], { compress: 0.76, format: ImageManipulator.SaveFormat.JPEG })
    await FileSystem.copyAsync({ from: thumbnail.uri, to: thumbnailUri })
    return { id, originalUri, thumbnailUri, takenAt: new Date().toISOString(), latitude: point.latitude, longitude: point.longitude, mimeType: asset.mimeType || 'image/jpeg', width: asset.width || null, height: asset.height || null }
  } catch (error) {
    await Promise.all([originalUri, thumbnailUri].map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined)))
    throw error
  }
}

export async function removeRidePhotoFiles(photos: RidePhotoDraft[] = []) {
  await Promise.all(photos.flatMap((photo) => [photo.originalUri, photo.thumbnailUri].map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined))))
}
