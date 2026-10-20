// Keep drafts and pending uploads isolated per backend. Legacy unscoped data
// remains on the device and is never automatically imported into another DB.
export function scopedStorageKey(key: string, backendUrl: string) {
  return `${key}:${new URL(backendUrl).origin}`
}
