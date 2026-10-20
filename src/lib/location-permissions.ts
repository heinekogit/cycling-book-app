import * as Location from 'expo-location'
import type { TFunction } from '@/i18n'

export type LocationPermissionIssue = 'foreground' | 'background'

export type LocationPermissionResult =
  | { granted: true; issue: null; message: string }
  | { granted: false; issue: LocationPermissionIssue; message: string }

export async function ensureRideLocationPermissions(t: TFunction): Promise<LocationPermissionResult> {
  let foreground = await Location.getForegroundPermissionsAsync()
  if (!foreground.granted && foreground.canAskAgain) {
    foreground = await Location.requestForegroundPermissionsAsync()
  }
  if (!foreground.granted) {
    return {
      granted: false,
      issue: 'foreground',
      message: foreground.canAskAgain
        ? t('permissionRequired')
        : t('foregroundPermission'),
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
      message: t('backgroundPermission'),
    }
  }

  return { granted: true, issue: null, message: t('permissionReady') }
}
