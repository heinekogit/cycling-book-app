import * as Location from 'expo-location'

export type LocationPermissionIssue = 'foreground' | 'background'

export type LocationPermissionResult =
  | { granted: true; issue: null; message: string }
  | { granted: false; issue: LocationPermissionIssue; message: string }

export async function ensureRideLocationPermissions(): Promise<LocationPermissionResult> {
  let foreground = await Location.getForegroundPermissionsAsync()
  if (!foreground.granted && foreground.canAskAgain) {
    foreground = await Location.requestForegroundPermissionsAsync()
  }
  if (!foreground.granted) {
    return {
      granted: false,
      issue: 'foreground',
      message: foreground.canAskAgain
        ? '走行記録には位置情報の許可が必要です'
        : '設定で位置情報を「このAppの使用中」に許可してください',
    }
  }

  let background = await Location.getBackgroundPermissionsAsync()
  if (!background.granted && background.canAskAgain) {
    background = await Location.requestBackgroundPermissionsAsync()
  }
  if (!background.granted) {
    return {
      granted: false,
      issue: 'background',
      message: '画面を閉じても記録するには、設定で位置情報を「常に」にしてください',
    }
  }

  return { granted: true, issue: null, message: '位置情報を利用できます' }
}
