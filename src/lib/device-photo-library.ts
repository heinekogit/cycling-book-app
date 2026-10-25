import { Asset, getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library'
import Storage from 'expo-sqlite/kv-store'

const SETTING_KEY = 'cycling-book.save-photos-to-device-library.v1'

export async function getSavePhotosToDeviceLibrary() {
  return (await Storage.getItem(SETTING_KEY)) === 'true'
}

export async function setSavePhotosToDeviceLibrary(enabled: boolean) {
  if (enabled) {
    const permission = await requestPermissionsAsync(true, ['photo'])
    if (!permission.granted) return false
  }
  await Storage.setItem(SETTING_KEY, String(enabled))
  return true
}

export async function saveRidePhotoToDeviceLibrary(uri: string) {
  if (!(await getSavePhotosToDeviceLibrary())) return false
  const permission = await getPermissionsAsync(true, ['photo'])
  if (!permission.granted) throw new Error('photo-library-permission')
  await Asset.create(uri)
  return true
}
