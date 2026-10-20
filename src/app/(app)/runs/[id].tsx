import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/auth'
import { ElevationChart } from '@/components/elevation-chart'
import { elevationProfileFromRecord } from '@/lib/elevation'
import { fetchRun, fetchRunPhotos, generateMissingRunElevation } from '@/lib/run-history'
import { averageSpeedKmh, coordinatesFromGeoJson, formatDuration, formatRunDate, type RunSummary } from '@/lib/run-history-model'
import type { RoutePhoto } from '@/lib/route-photos'
import { useI18n } from '@/i18n'

const FALLBACK_REGION: Region = { latitude: 35.681236, longitude: 139.767125, latitudeDelta: 0.03, longitudeDelta: 0.03 }

export default function RunDetailScreen() {
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const { id } = useLocalSearchParams<{ id: string }>()
  const mapRef = useRef<MapView>(null)
  const [run, setRun] = useState<RunSummary | null>(null)
  const [photos, setPhotos] = useState<RoutePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [isSharingPhoto, setIsSharingPhoto] = useState(false)
  const coordinates = useMemo(() => coordinatesFromGeoJson(run?.geojson), [run?.geojson])
  const elevationProfile = useMemo(() => elevationProfileFromRecord(run ? { elevation_profile: run.elevationProfile, elevation_gain_m: run.elevationGainMeters, elevation_loss_m: run.elevationLossMeters, elevation_min_m: run.elevationMinMeters, elevation_max_m: run.elevationMaxMeters } : null), [run])

  const loadRun = useCallback(async () => {
    if (!session?.user.id || !id) return
    setIsLoading(true)
    setErrorMessage('')
    try {
      const result = await fetchRun(session.user.id, id, t)
      setRun(result)
      if (result) setPhotos(await fetchRunPhotos(session.user.id, id, result.startedAt, t).catch(() => []))
      if (result && !elevationProfileFromRecord({ elevation_profile: result.elevationProfile })) {
        const points = coordinatesFromGeoJson(result.geojson)
        if (points.length >= 2) void generateMissingRunElevation(session.user.id, id, points, t).then((profile) => {
          if (!profile) return
          setRun((current) => current ? { ...current, elevationProfile: { version: 1, distances_m: profile.distances, elevations_m: profile.elevations }, elevationGainMeters: profile.gain, elevationLossMeters: profile.loss, elevationMinMeters: profile.minimum, elevationMaxMeters: profile.maximum } : current)
        }).catch(() => undefined)
      }
      if (!result) setErrorMessage(t('runNotFound'))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('runLoadFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [id, session, t])

  useFocusEffect(useCallback(() => { void loadRun() }, [loadRun]))
  useEffect(() => {
    if (coordinates.length < 2) return
    const timer = setTimeout(() => mapRef.current?.fitToCoordinates(coordinates, { edgePadding: { top: 45, right: 35, bottom: 45, left: 35 }, animated: false }), 150)
    return () => clearTimeout(timer)
  }, [coordinates])

  const initialRegion = coordinates[0]
    ? { ...coordinates[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : FALLBACK_REGION
  const selectedPhoto = selectedPhotoIndex == null ? null : photos[selectedPhotoIndex] ?? null

  const sharePhoto = async () => {
    if (!selectedPhoto || isSharingPhoto) return
    setIsSharingPhoto(true)
    let fileUri: string | null = null
    try {
      if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) throw new Error('Sharing unavailable')
      const path = selectedPhoto.imageUrl.split('?')[0]
      const extension = path.match(/\.(jpe?g|png|webp|heic)$/i)?.[1]?.toLowerCase() || 'jpg'
      fileUri = `${FileSystem.cacheDirectory}cycling-book-photo-${selectedPhoto.id}.${extension}`
      const download = await FileSystem.downloadAsync(selectedPhoto.imageUrl, fileUri)
      const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'heic' ? 'image/heic' : 'image/jpeg'
      await Sharing.shareAsync(download.uri, { dialogTitle: t('sharePhoto'), mimeType, UTI: 'public.image' })
    } catch {
      Alert.alert(t('sharePhotoFailed'))
    } finally {
      if (fileUri) await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined)
      setIsSharingPhoto(false)
    }
  }

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable style={styles.headerButton} onPress={() => router.back()}><Text style={styles.headerButtonText}>{t('backToHistory')}</Text></Pressable>
      <Text style={styles.headerTitle}>{t('rideDetail')}</Text>
      <View style={styles.headerSpacer} />
    </View>
    {isLoading
      ? <View style={styles.center}><ActivityIndicator size="large" color="#245D40" /><Text style={styles.supportText}>{t('loadingRun')}</Text></View>
      : errorMessage || !run
        ? <View style={styles.center}><Text style={styles.errorTitle}>{t('displayFailed')}</Text><Text style={styles.errorText}>{errorMessage}</Text><Pressable style={styles.retryButton} onPress={() => { void loadRun() }}><Text style={styles.retryText}>{t('retry')}</Text></Pressable></View>
        : <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.mapCard}>
              {coordinates.length > 0
                ? <MapView ref={mapRef} style={styles.map} provider={PROVIDER_DEFAULT} initialRegion={initialRegion} scrollEnabled zoomEnabled rotateEnabled={false} pitchEnabled={false}>
                    <Polyline coordinates={coordinates} strokeColor="#FF66FF" strokeWidth={6} />
                    <Marker coordinate={coordinates[0]} title={t('markerStart')} pinColor="#286F4A" />
                    {coordinates.length > 1 && <Marker coordinate={coordinates.at(-1)!} title={t('markerEnd')} pinColor="#D2613D" />}
                    {photos.map((photo, index) => photo.latitude == null || photo.longitude == null ? null : <Marker key={`photo-${photo.id}`} coordinate={{ latitude: photo.latitude, longitude: photo.longitude }} anchor={{ x: 0.5, y: 0.5 }} onPress={() => setSelectedPhotoIndex(index)} accessibilityLabel={t('openPhotoAtLocation')}><View style={styles.photoMapPin}><View style={styles.photoMapPinCore} /></View></Marker>)}
                  </MapView>
                : <View style={styles.noMap}><Text style={styles.noMapTitle}>{t('noTrack')}</Text><Text style={styles.supportText}>{t('noTrackHelp')}</Text></View>}
            </View>
            <View style={styles.summary}>
              <Text style={styles.runName}>{run.name}</Text>
              <Text style={styles.runDate}>{formatRunDate(run.startedAt, locale, t('unknownDate'))}</Text>
              <View style={styles.metrics}>
                <Metric label={t('distance')} value={(run.distanceMeters / 1000).toFixed(2)} unit="km" />
                <Metric label={t('rideDuration')} value={formatDuration(run.durationSeconds)} />
                <Metric label={t('averageSpeed')} value={averageSpeedKmh(run.distanceMeters, run.durationSeconds).toFixed(1)} unit="km/h" />
              </View>
              <View style={styles.timeRows}>
                <TimeRow label={t('markerStart')} value={formatRunDate(run.startedAt, locale, t('unknownDate'))} />
                <TimeRow label={t('markerEnd')} value={formatRunDate(run.endedAt, locale, t('unknownDate'))} />
                <TimeRow label={t('recordedPoints')} value={t('pointsCount', { points: coordinates.length })} />
              </View>
              {elevationProfile && <View style={styles.elevationSection}>
                <Text style={styles.sectionTitle}>{t('elevationProfile')}</Text>
                <View style={styles.elevationMetrics}>
                  <Metric label={t('elevationGain')} value={String(Math.round(elevationProfile.gain))} unit="m" />
                  <Metric label={t('elevationLoss')} value={String(Math.round(elevationProfile.loss))} unit="m" />
                  <Metric label={t('averageGrade')} value={elevationProfile.averageGrade.toFixed(1)} unit="%" />
                </View>
                <ElevationChart profile={elevationProfile} />
              </View>}
            </View>
            {photos.length > 0 && <View style={styles.photoSection}><Text style={[styles.sectionTitle, styles.photoSectionTitle]}>{t('routePhotos')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>{photos.map((photo, index) => <Pressable key={photo.id} onPress={() => setSelectedPhotoIndex(index)} accessibilityRole="button" accessibilityLabel={t('photoViewer')}><Image source={{ uri: photo.thumbUrl || photo.imageUrl }} style={styles.photo} accessibilityLabel={t('routePhoto')} /></Pressable>)}</ScrollView></View>}
          </ScrollView>}
    <Modal visible={selectedPhoto != null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setSelectedPhotoIndex(null)}>
      <SafeAreaView style={styles.viewer}>
        <View style={styles.viewerHeader}>
          <Text style={styles.viewerTitle}>{t('photoViewer')}</Text>
          <Text style={styles.viewerCount}>{selectedPhotoIndex == null ? '' : t('photoCount', { current: selectedPhotoIndex + 1, total: photos.length })}</Text>
        </View>
        {selectedPhoto && <Image source={{ uri: selectedPhoto.imageUrl }} style={styles.viewerImage} resizeMode="contain" accessibilityLabel={t('routePhoto')} />}
        <View style={styles.viewerFooter}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewerThumbs}>{photos.map((photo, index) => <Pressable key={photo.id} style={[styles.viewerThumbButton, index === selectedPhotoIndex && styles.viewerThumbSelected]} onPress={() => setSelectedPhotoIndex(index)}><Image source={{ uri: photo.thumbUrl || photo.imageUrl }} style={styles.viewerThumb} /></Pressable>)}</ScrollView>
          <View style={styles.viewerActions}>
            <Pressable style={styles.closePhotoButton} onPress={() => setSelectedPhotoIndex(null)}><Text style={styles.closePhotoButtonText}>{t('close')}</Text></Pressable>
            <Pressable disabled={isSharingPhoto} style={[styles.sharePhotoButton, isSharingPhoto && styles.sharePhotoButtonDisabled]} onPress={() => { void sharePhoto() }}><Text style={styles.sharePhotoButtonText}>{isSharingPhoto ? t('sharingPhoto') : t('sharePhoto')}</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}{unit && <Text style={styles.metricUnit}> {unit}</Text>}</Text></View>
}

function TimeRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.timeRow}><Text style={styles.timeLabel}>{label}</Text><Text style={styles.timeValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F5F1' }, header: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E1D9', backgroundColor: '#FFF' }, headerButton: { width: 80, paddingVertical: 10 }, headerButtonText: { color: '#246A47', fontSize: 15, fontWeight: '700' }, headerTitle: { flex: 1, color: '#17251B', fontSize: 17, fontWeight: '800', textAlign: 'center' }, headerSpacer: { width: 80 },
  content: { paddingBottom: 36 }, mapCard: { height: 340, backgroundColor: '#DCE5DD' }, map: { flex: 1 }, noMap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }, noMapTitle: { color: '#425247', fontSize: 16, fontWeight: '800' }, summary: { marginTop: -20, marginHorizontal: 14, padding: 20, borderRadius: 22, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DCE4DC' }, runName: { color: '#192A1E', fontSize: 22, fontWeight: '800' }, runDate: { marginTop: 6, color: '#738078', fontSize: 12 }, metrics: { marginTop: 22, paddingVertical: 17, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E0E6E0', flexDirection: 'row' }, metric: { flex: 1 }, metricLabel: { marginBottom: 6, color: '#7B867E', fontSize: 10, fontWeight: '700' }, metricValue: { color: '#1E3024', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }, metricUnit: { color: '#69756D', fontSize: 9 }, timeRows: { marginTop: 14 }, timeRow: { paddingVertical: 9, flexDirection: 'row', justifyContent: 'space-between', gap: 16 }, timeLabel: { color: '#7A857D', fontSize: 12, fontWeight: '700' }, timeValue: { flex: 1, color: '#35463A', fontSize: 12, textAlign: 'right' },
  elevationSection: { marginTop: 14, paddingTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0E6E0' }, sectionTitle: { color: '#173F2B', fontSize: 16, fontWeight: '900' }, elevationMetrics: { marginTop: 13, flexDirection: 'row', gap: 10 }, photoSection: { marginTop: 16, paddingVertical: 18, backgroundColor: '#FFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#DCE4DC' }, photoSectionTitle: { paddingHorizontal: 18 }, photoRow: { paddingHorizontal: 18, paddingTop: 12, gap: 10 }, photo: { width: 190, height: 130, borderRadius: 14, backgroundColor: '#E4EAE4' },
  photoMapPin: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#FFF', backgroundColor: '#EF6D3F', alignItems: 'center', justifyContent: 'center', shadowColor: '#51200F', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } }, photoMapPinCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  viewer: { flex: 1, backgroundColor: '#101511' }, viewerHeader: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#39433B' }, viewerTitle: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '800' }, viewerCount: { color: '#AEB9B0', fontSize: 12, textAlign: 'right' }, viewerImage: { flex: 1, width: '100%' }, viewerFooter: { paddingTop: 10, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#39433B' }, viewerThumbs: { paddingHorizontal: 14, gap: 8 }, viewerThumbButton: { padding: 2, borderWidth: 2, borderColor: 'transparent', borderRadius: 10 }, viewerThumbSelected: { borderColor: '#75B98D' }, viewerThumb: { width: 58, height: 46, borderRadius: 6, backgroundColor: '#273028' }, viewerActions: { flexDirection: 'row', gap: 10, marginTop: 12, marginHorizontal: 14 }, closePhotoButton: { minHeight: 48, minWidth: 104, paddingHorizontal: 18, borderWidth: 1, borderColor: '#66736A', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, closePhotoButtonText: { color: '#DCE5DE', fontSize: 14, fontWeight: '800' }, sharePhotoButton: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#2B7950', alignItems: 'center', justifyContent: 'center' }, sharePhotoButtonDisabled: { opacity: 0.6 }, sharePhotoButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, supportText: { marginTop: 10, color: '#7A857D', fontSize: 12, lineHeight: 19, textAlign: 'center' }, errorTitle: { color: '#8F3D29', fontSize: 17, fontWeight: '800' }, errorText: { marginTop: 9, color: '#765D56', fontSize: 12, lineHeight: 18, textAlign: 'center' }, retryButton: { marginTop: 20, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, backgroundColor: '#245D40' }, retryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
})
