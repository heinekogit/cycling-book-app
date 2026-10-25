import { RouteSpotPopup } from '@/components/route-spot-popup'
import { RouteSpotMarker } from '@/components/route-spot-marker'
import { RouteSpotViewer } from '@/components/route-spot-viewer'
import { useRouteSpots } from '@/hooks/use-route-spots'
import type { RouteSpot } from '@/lib/route-spots'
import * as Linking from 'expo-linking'
import { type Href, router, useLocalSearchParams } from 'expo-router'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/auth'
import { ElevationChart } from '@/components/elevation-chart'
import { generateElevationProfile, type ElevationProfile } from '@/lib/elevation'
import { useRideRecorder } from '@/hooks/use-ride-recorder'
import { useI18n } from '@/i18n'
import { routeCoordinates, type SavedRoute } from '@/lib/saved-route-model'
import { fetchSavedRoute } from '@/lib/saved-routes'
import { distanceToRouteMeters, routeProgressMeters, OFF_ROUTE_THRESHOLD_METERS, splitTrackByRoute } from '@/lib/route-following'
import { ROUTE_LINE_COLOR, RouteDirectionArrows } from '@/route-direction-arrows'
import { captureRidePhoto } from '@/lib/ride-photo-capture'

const DEFAULT_REGION: Region = { latitude: 35.681236, longitude: 139.767125, latitudeDelta: 0.03, longitudeDelta: 0.03 }
const MAP_FOLLOW_RESUME_DELAY_MS = 10_000
const MAP_FOLLOW_RESUME_SPEED_KMH = 5
const formatTime = (seconds: number) => [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':')

export default function RideScreen() {
  const { t } = useI18n()
  const { session, signOut } = useAuth()
  const { routeId } = useLocalSearchParams<{ routeId?: string }>()
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null)
  const [isRouteLoading, setIsRouteLoading] = useState(!!routeId)
  const [routeError, setRouteError] = useState('')
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false)
  const [runName, setRunName] = useState('')
  const [isMapFollowing, setIsMapFollowing] = useState(true)
  const [lastMapInteractionAt, setLastMapInteractionAt] = useState(0)
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false)
  const [elevationResult, setElevationResult] = useState<{ coordinates: { latitude: number; longitude: number }[]; attempt: number; profile: ElevationProfile | null } | null>(null)
  const [isElevationVisible, setIsElevationVisible] = useState(true)
  const [elevationRetry, setElevationRetry] = useState(0)
  useEffect(() => {
    if (!routeId || !session?.user.id) return
    let active = true
    fetchSavedRoute(session.user.id, routeId, t).then((route) => {
      if (!active) return
      setSelectedRoute(route)
      if (!route) setRouteError(t('routeNotFound'))
    }).catch((error) => { if (active) setRouteError(error instanceof Error ? error.message : t('routeLoadFailed')) }).finally(() => { if (active) setIsRouteLoading(false) })
    return () => { active = false }
  }, [routeId, session?.user.id, t])
  const selectedPlan = useMemo(() => selectedRoute ? { routeId: selectedRoute.id, routeName: selectedRoute.name, coordinates: routeCoordinates(selectedRoute) } : null, [selectedRoute])
  const [arrowRegion, setArrowRegion] = useState<Region | null>(null)
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 })
  const arrowViewport = useMemo(() => arrowRegion ? { ...arrowRegion, ...mapSize } : null, [arrowRegion, mapSize])
  const mapRef = useRef<MapView>(null)
  const {
    rideState, draft, elapsedSeconds, speedKmh, distanceMeters, message,
    hasUnsavedRide, permissionIssue, pendingCount, isSyncing, syncNow, start, pause, finishAndSave, addPhoto, discardRide, resetFinishedRide,
  } = useRideRecorder(session, selectedPlan)
  const activePlan = draft?.plan ?? selectedPlan
  const { spots, failed: spotsFailed, retry: retrySpots } = useRouteSpots(activePlan?.routeId)
  const [popupSpot, setPopupSpot] = useState<RouteSpot | null>(null)
  const [selectedSpot, setSelectedSpot] = useState<RouteSpot | null>(null)
  const plannedTrack = useMemo(() => activePlan?.coordinates ?? [], [activePlan])

  const hasElevationResult = elevationResult?.coordinates === plannedTrack && elevationResult?.attempt === elevationRetry
  const elevationProfile = hasElevationResult ? elevationResult.profile : null
  const isElevationLoading = plannedTrack.length > 1 && !hasElevationResult

  useEffect(() => {
    let active = true
    if (plannedTrack.length > 1) {
      void generateElevationProfile(plannedTrack).then((profile) => {
        if (active) setElevationResult({ coordinates: plannedTrack, attempt: elevationRetry, profile })
      }).catch(() => {
        if (active) setElevationResult({ coordinates: plannedTrack, attempt: elevationRetry, profile: null })
      })
    }
    return () => { active = false }
  }, [plannedTrack, elevationRetry])

  useEffect(() => {
    if (!draft?.currentPoint || !isMapFollowing) return
    mapRef.current?.animateCamera({ center: draft.currentPoint, zoom: 17 }, { duration: 500 })
  }, [draft?.currentPoint, isMapFollowing])

  useEffect(() => {
    if (popupSpot || selectedSpot || isMapFollowing || speedKmh < MAP_FOLLOW_RESUME_SPEED_KMH) return
    const remainingDelay = Math.max(0, lastMapInteractionAt + MAP_FOLLOW_RESUME_DELAY_MS - Date.now())
    const timer = setTimeout(() => setIsMapFollowing(true), remainingDelay)
    return () => clearTimeout(timer)
  }, [isMapFollowing, lastMapInteractionAt, speedKmh, selectedSpot, popupSpot])

  const suspendMapFollowing = () => {
    setIsMapFollowing(false)
    setLastMapInteractionAt(Date.now())
  }

  useEffect(() => {
    if (draft?.currentPoint || plannedTrack.length < 2) return
    const timer = setTimeout(() => mapRef.current?.fitToCoordinates(plannedTrack, { edgePadding: { top: 90, right: 35, bottom: isElevationVisible ? 420 : 290, left: 35 }, animated: false }), 150)
    return () => clearTimeout(timer)
  }, [draft?.currentPoint, plannedTrack, isElevationVisible])

  const openSaveModal = () => {
    const date = new Date()
    setRunName(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${t('runNameSuffix')}`)
    setIsSaveModalVisible(true)
  }

  const saveRide = () => {
    const name = runName.trim()
    if (!name) return
    setIsSaveModalVisible(false)
    void finishAndSave(name)
  }

  const takePhoto = async () => {
    if (!currentPoint || isCapturingPhoto) return
    setIsCapturingPhoto(true)
    try {
      const photo = await captureRidePhoto(currentPoint)
      if (!photo) return
      await addPhoto(photo)
      Alert.alert(t('photoSaved'))
    } catch (error) {
      Alert.alert(error instanceof Error && error.message === 'camera-permission' ? t('cameraPermissionRequired') : error instanceof Error && error.message === 'photo-too-large' ? t('photoTooLarge') : t('photoCaptureFailed'))
    } finally {
      setIsCapturingPhoto(false)
    }
  }

  const confirmDiscard = () => {
    Alert.alert(t('discardConfirmTitle'), t('discardConfirmBody'), [
      { text: t('keepEditing'), style: 'cancel' },
      { text: t('discardRide'), style: 'destructive', onPress: () => { setIsSaveModalVisible(false); void discardRide() } },
    ])
  }

  const startAnotherRide = () => {
    if (!hasUnsavedRide) {
      resetFinishedRide()
      void start()
      return
    }
    Alert.alert(t('unsavedTitle'), t('unsavedBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('discardStart'), style: 'destructive', onPress: () => { void start(true) } },
    ])
  }

  const currentPoint = draft?.currentPoint
  const routeProgress = useMemo(() => currentPoint ? routeProgressMeters(currentPoint, plannedTrack) : null, [currentPoint, plannedTrack])
  const track = useMemo(() => draft?.points ?? [], [draft?.points])
  const liveSegments = useMemo(() => splitTrackByRoute(track, plannedTrack), [plannedTrack, track])
  const isOffRoute = useMemo(() => Boolean(currentPoint && plannedTrack.length > 1 && distanceToRouteMeters(currentPoint, plannedTrack) > OFF_ROUTE_THRESHOLD_METERS), [currentPoint, plannedTrack])
  const isRecording = rideState === 'riding'
  const isBusy = rideState === 'locating' || rideState === 'saving' || isRouteLoading
  const cannotStartRoute = !!routeId && !selectedRoute && !draft?.plan
  const canFinish = ['riding', 'paused', 'finished'].includes(rideState) && hasUnsavedRide

  return <View style={styles.screen}>
    <MapView ref={mapRef} onRegionChangeComplete={setArrowRegion} onLayout={(event) => { const { width, height } = event.nativeEvent.layout; setMapSize({ width, height }) }} style={StyleSheet.absoluteFill} provider={PROVIDER_DEFAULT} initialRegion={DEFAULT_REGION} showsCompass showsScale onPress={() => { setPopupSpot(null); setLastMapInteractionAt(Date.now()) }} onTouchStart={suspendMapFollowing} onPanDrag={suspendMapFollowing}>
      {plannedTrack.length > 1 && <><Polyline coordinates={plannedTrack} strokeColor={ROUTE_LINE_COLOR} strokeWidth={6} /><RouteDirectionArrows coordinates={plannedTrack} viewport={arrowViewport} /></>}
      {liveSegments.map((segment, index) => segment.isOffRoute
        ? <Fragment key={`off-${index}`}><Polyline coordinates={segment.coordinates} strokeColor="#FFF" strokeWidth={12} /><Polyline coordinates={segment.coordinates} strokeColor="#E53935" strokeWidth={8} /></Fragment>
        : <Polyline key={`on-${index}`} coordinates={segment.coordinates} strokeColor="#FF66FF" strokeWidth={6} />)}
      {currentPoint && <Marker coordinate={currentPoint} anchor={{ x: 0.5, y: 0.5 }}><View style={styles.currentMarker}><View style={styles.currentMarkerCore} /></View></Marker>}
      {(draft?.photos ?? []).map((photo) => <Marker key={photo.id} coordinate={{ latitude: photo.latitude, longitude: photo.longitude }} anchor={{ x: 0.5, y: 0.5 }}><View style={styles.photoMarker}><Text style={styles.photoMarkerIcon}>●</Text></View></Marker>)}
{spots.map((spot) => <RouteSpotMarker key={spot.id} spot={spot} onSelect={() => { suspendMapFollowing(); setPopupSpot(spot) }} />)}
    </MapView>
    <RouteSpotViewer spot={selectedSpot} onClose={() => { setSelectedSpot(null); setLastMapInteractionAt(Date.now()) }} />
    <SafeAreaView style={styles.overlay} pointerEvents="box-none">
      <View style={styles.header}>
        <View style={styles.brandBlock}><Text style={styles.brand}>Cycling Book</Text><Text style={styles.subtitle} numberOfLines={1}>{activePlan ? t('plannedRoute') : t('rideRecord')}</Text></View>
        <View style={styles.headerActions}>
          <Pressable style={styles.languageButton} onPress={() => router.push('/' as Href)}><Text style={styles.languageButtonText}>{t('home')}</Text></Pressable>
          <Pressable style={styles.historyButton} onPress={() => router.push('/runs' as Href)}><Text style={styles.historyButtonText}>{t('history')}</Text></Pressable>
          <Pressable onPress={signOut} disabled={hasUnsavedRide}><Text style={[styles.signOut, hasUnsavedRide && styles.signOutDisabled]}>{t('signOut')}</Text></Pressable>
        </View>
      </View>
      {isOffRoute && <View style={styles.offRouteWarning} accessibilityRole="alert"><View style={styles.offRouteWarningIcon}><Text style={styles.offRouteWarningMark}>!</Text></View><View style={styles.offRouteWarningCopy}><Text style={styles.offRouteWarningTitle}>{t('offRouteWarningTitle')}</Text><Text style={styles.offRouteWarningBody}>{t('offRouteWarningBody')}</Text></View></View>}
      <View style={styles.mapNotice}>
        {isBusy && <ActivityIndicator color="#2B7950" size="small" />}
        <View style={styles.noticeCopy}>
          <Text style={styles.mapNoticeTitle}>{message}</Text>
          {activePlan && <Text style={styles.routeName} numberOfLines={1}>{t('selectedRoute', { name: activePlan.routeName })}</Text>}
          {spotsFailed && <Pressable onPress={retrySpots}><Text style={styles.routeError}>{t('spotsLoadFailed')}</Text></Pressable>}
          {!!routeError && <Text style={styles.routeError}>{routeError}</Text>}
          <Text style={styles.mapNoticeText}>{currentPoint ? t('accuracyPoints', { accuracy: Math.round(currentPoint.accuracy), points: track.length }) : t('waitingForLocation')}</Text>
          {permissionIssue && <Pressable onPress={() => { void Linking.openSettings() }}><Text style={styles.settingsLink}>{t('openSettings')}</Text></Pressable>}
        </View>
      </View>
      {activePlan && <View style={styles.legend}>
        <LegendItem color={ROUTE_LINE_COLOR} label={t('plannedRoute')} />
        <LegendItem color="#FF66FF" label={t('actualTrack')} />
        <LegendItem color="#E53935" label={t('offRoute')} outlined />
      </View>}
      <View style={styles.spacer} />
      <View style={styles.panel}>
        {activePlan && <View style={styles.elevationSection}>
          <Pressable style={styles.elevationHeading} accessibilityRole="button" accessibilityState={{ expanded: isElevationVisible }} onPress={() => setIsElevationVisible((visible) => !visible)}>
            <Text style={styles.elevationTitle}>{t('plannedElevation')}</Text>
            <Text style={styles.elevationToggle}>{isElevationVisible ? t('hideElevation') : t('showElevation')}</Text>
          </Pressable>
          {isElevationVisible && (isElevationLoading
            ? <View style={styles.elevationStatus}><ActivityIndicator size="small" color="#2B7950" /><Text style={styles.elevationStatusText}>{t('loadingElevation')}</Text></View>
            : elevationProfile
              ? <ElevationChart profile={elevationProfile} height={110} fullWidth currentDistanceMeters={routeProgress} currentPositionLabel={t('elevationCurrentPosition')} />
              : <View style={styles.elevationStatus}><Text style={styles.elevationStatusText}>{t('elevationUnavailable')}</Text><Pressable accessibilityRole="button" onPress={() => setElevationRetry((value) => value + 1)}><Text style={styles.elevationToggle}>{t('retryElevation')}</Text></Pressable></View>)}
        </View>}
        <Text style={styles.account} numberOfLines={1}>{session?.user.email}</Text>
        <View style={styles.metrics}><View style={[styles.metric, styles.metricWide]}><Text style={styles.metricLabel}>{t('elapsedTime')}</Text><Text style={styles.metricValue}>{formatTime(elapsedSeconds)}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>{t('distance')}</Text><Text style={styles.metricValue}>{(distanceMeters / 1000).toFixed(2)}<Text style={styles.unit}> km</Text></Text></View><View style={styles.metric}><Text style={styles.metricLabel}>{t('speed')}</Text><Text style={styles.metricValue}>{speedKmh.toFixed(1)}<Text style={styles.unit}> km/h</Text></Text></View></View>
        <Pressable style={[styles.captureButton, (!canFinish || !currentPoint || isCapturingPhoto) && styles.disabled]} disabled={!canFinish || !currentPoint || isCapturingPhoto} onPress={() => { void takePhoto() }}><Text style={styles.captureButtonText}>📷　{isCapturingPhoto ? t('takingPhoto') : t('takePhoto')}{(draft?.photos?.length ?? 0) > 0 ? ` (${draft?.photos?.length})` : ''}</Text></Pressable>
        <View style={styles.actions}>
          {isRecording
            ? <Pressable style={[styles.action, styles.pause]} onPress={pause}><Text style={styles.actionText}>Ⅱ　{t('pause')}</Text></Pressable>
            : <Pressable style={[styles.action, styles.start, (isBusy || cannotStartRoute) && styles.disabled]} onPress={rideState === 'finished' && hasUnsavedRide ? openSaveModal : rideState === 'finished' ? startAnotherRide : () => { void start() }} disabled={isBusy || cannotStartRoute}><Text style={styles.actionText}>▶　{rideState === 'paused' ? t('resume') : rideState === 'finished' && hasUnsavedRide ? t('retrySave') : rideState === 'finished' ? t('startAgain') : t('start')}</Text></Pressable>}
          <Pressable style={[styles.action, styles.finish, !canFinish && styles.disabled]} disabled={!canFinish || isBusy} onPress={openSaveModal}><Text style={styles.finishText}>■　{t('finishSave')}</Text></Pressable>
        </View>
        <Text style={styles.note}>{t('localBackupNote')}</Text>
        {pendingCount > 0 && <View style={styles.syncRow}>
          <Text style={styles.pendingText}>{t('pendingSync', { count: pendingCount })}</Text>
          <Pressable style={[styles.syncButton, isSyncing && styles.disabled]} disabled={isSyncing} onPress={() => { void syncNow() }}>
            <Text style={styles.syncButtonText}>{isSyncing ? t('syncing') : t('syncNow')}</Text>
          </Pressable>
        </View>}
      </View>
    </SafeAreaView>
    <RouteSpotPopup spot={popupSpot} top={150} onClose={() => { setPopupSpot(null); setLastMapInteractionAt(Date.now()) }} onOpenPhotos={() => setSelectedSpot(popupSpot)} />
    <Modal visible={isSaveModalVisible} transparent animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.saveModal} accessibilityViewIsModal>
          <Text style={styles.saveModalTitle}>{t('confirmFinishTitle')}</Text>
          <Text style={styles.saveModalBody}>{t('confirmFinishBody')}</Text>
          <Text style={styles.runNameLabel}>{t('runNameLabel')}</Text>
          <TextInput style={styles.runNameInput} value={runName} onChangeText={setRunName} autoFocus selectTextOnFocus maxLength={100} returnKeyType="done" onSubmitEditing={saveRide} />
          <Pressable style={[styles.saveButton, !runName.trim() && styles.disabled]} disabled={!runName.trim()} onPress={saveRide}><Text style={styles.saveButtonText}>{t('finishSave')}</Text></Pressable>
          <Pressable style={styles.discardButton} onPress={confirmDiscard}><Text style={styles.discardButtonText}>{t('discardRide')}</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>
}

function LegendItem({ color, label, outlined = false }: { color: string; label: string; outlined?: boolean }) {
  return <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: color }, outlined && styles.legendLineOutlined]} /><Text style={styles.legendText}>{label}</Text></View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#DFE8DD' }, overlay: { flex: 1 }, header: { marginHorizontal: 12, padding: 13, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brandBlock: { flexShrink: 1, marginRight: 8 }, brand: { color: '#173F2B', fontSize: 16, fontWeight: '800' }, subtitle: { marginTop: 2, color: '#738078', fontSize: 11, fontWeight: '600' }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, languageButton: { paddingHorizontal: 8, paddingVertical: 8 }, languageButtonText: { color: '#246A47', fontSize: 10, fontWeight: '800' }, historyButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E9F1EB' }, historyButtonText: { color: '#245D40', fontSize: 11, fontWeight: '800' }, signOut: { color: '#657168', fontSize: 10, fontWeight: '700' }, signOutDisabled: { opacity: 0.35 }, offRouteWarning: { marginTop: 10, marginHorizontal: 18, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 2, borderColor: '#FFF', borderRadius: 14, backgroundColor: '#D92D2D', flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#7A1414', shadowOpacity: .24, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } }, offRouteWarningIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, offRouteWarningMark: { color: '#D92D2D', fontSize: 17, fontWeight: '900' }, offRouteWarningCopy: { flex: 1 }, offRouteWarningTitle: { color: '#FFF', fontSize: 13, fontWeight: '900' }, offRouteWarningBody: { marginTop: 2, color: '#FFE5E5', fontSize: 10, fontWeight: '700' },
  mapNotice: { marginTop: 10, marginHorizontal: 18, alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', gap: 9 }, noticeCopy: { flexShrink: 1 }, mapNoticeTitle: { color: '#2B3A30', fontSize: 11, fontWeight: '800' }, routeName: { marginTop: 3, color: ROUTE_LINE_COLOR, fontSize: 10, fontWeight: '800' }, routeError: { marginTop: 3, color: '#A53D25', fontSize: 10, fontWeight: '700' }, mapNoticeText: { marginTop: 2, color: '#758078', fontSize: 10 }, settingsLink: { marginTop: 7, color: '#246A47', fontSize: 11, fontWeight: '800', textDecorationLine: 'underline' }, legend: { marginTop: 7, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.92)', flexDirection: 'row', gap: 11 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, legendLine: { width: 14, height: 4, borderRadius: 2 }, legendLineOutlined: { height: 6, borderWidth: 1, borderColor: '#FFF', shadowColor: '#4B1111', shadowOpacity: .25, shadowRadius: 1 }, legendText: { color: '#5F6C63', fontSize: 8, fontWeight: '800' }, spacer: { flex: 1 }, currentMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#173F2B', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } }, currentMarkerCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF6D3F' },
  photoMarker: { width: 24, height: 24, borderWidth: 3, borderColor: '#FFF', borderRadius: 12, backgroundColor: '#EF6D3F', alignItems: 'center', justifyContent: 'center', shadowColor: '#51200F', shadowOpacity: 0.3, shadowRadius: 3 }, photoMarkerIcon: { color: '#FFF', fontSize: 8 },
  elevationSection: { marginBottom: 12 }, elevationHeading: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, elevationTitle: { color: '#173F2B', fontSize: 12, fontWeight: '800' }, elevationToggle: { color: '#246A47', fontSize: 11, fontWeight: '700', paddingVertical: 6 }, elevationStatus: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, elevationStatusText: { color: '#738078', fontSize: 11, flexShrink: 1 },
  panel: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFF' }, account: { marginBottom: 13, color: '#89938C', fontSize: 10, textAlign: 'center' }, metrics: { flexDirection: 'row' }, metric: { flex: 1, alignItems: 'center', paddingHorizontal: 5, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E9E5' }, metricWide: { flex: 1.35, borderLeftWidth: 0 }, metricLabel: { marginBottom: 5, color: '#79837C', fontSize: 10, fontWeight: '700' }, metricValue: { color: '#17221B', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }, unit: { color: '#68746C', fontSize: 9 }, captureButton: { minHeight: 42, marginTop: 16, borderWidth: 1, borderColor: '#AFC7B5', borderRadius: 12, backgroundColor: '#EFF7F0', alignItems: 'center', justifyContent: 'center' }, captureButtonText: { color: '#276044', fontSize: 12, fontWeight: '900' }, actions: { marginTop: 10, flexDirection: 'row', gap: 10 }, action: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, start: { flex: 1.7, backgroundColor: '#173F2B' }, pause: { flex: 1.7, backgroundColor: '#D59622' }, finish: { flex: 1, borderWidth: 1, borderColor: '#E4CFC8', backgroundColor: '#FFF4F0' }, disabled: { opacity: 0.45 }, actionText: { color: '#FFF', fontSize: 13, fontWeight: '800' }, finishText: { color: '#B74726', fontSize: 12, fontWeight: '800' }, note: { marginTop: 10, color: '#8A948D', fontSize: 9, lineHeight: 13, textAlign: 'center' }, syncRow: { marginTop: 9, padding: 8, borderRadius: 10, backgroundColor: '#FFF4D9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, pendingText: { color: '#785915', fontSize: 10, fontWeight: '800' }, syncButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#245D40' }, syncButtonText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(15,28,20,0.58)', alignItems: 'center', justifyContent: 'center' }, saveModal: { width: '100%', maxWidth: 420, padding: 22, borderRadius: 20, backgroundColor: '#FFF' }, saveModalTitle: { color: '#173F2B', fontSize: 20, fontWeight: '900' }, saveModalBody: { marginTop: 7, color: '#68746C', fontSize: 13, lineHeight: 19 }, runNameLabel: { marginTop: 20, marginBottom: 7, color: '#3F5045', fontSize: 12, fontWeight: '800' }, runNameInput: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: '#B8C7BC', borderRadius: 11, color: '#17221B', backgroundColor: '#FAFCFA', fontSize: 16 }, saveButton: { marginTop: 16, minHeight: 48, borderRadius: 12, backgroundColor: '#173F2B', alignItems: 'center', justifyContent: 'center' }, saveButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' }, discardButton: { marginTop: 10, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E4CFC8', backgroundColor: '#FFF4F0', alignItems: 'center', justifyContent: 'center' }, discardButtonText: { color: '#B74726', fontSize: 13, fontWeight: '800' },
})
