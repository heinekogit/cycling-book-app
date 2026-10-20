import { coordinateAtFraction } from '@/lib/elevation-selection'
import { routeProgressMeters } from '@/lib/route-following'
import { routeDistanceMeters } from '@/lib/saved-route-model'
import { RouteElevation } from '@/components/route-elevation'
import { RouteSpotPopup } from '@/components/route-spot-popup'
import { RouteSpotMarker } from '@/components/route-spot-marker'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native'
import MapView, { Circle, Marker, Polyline, PROVIDER_DEFAULT, type Region } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/auth'
import { useI18n } from '@/i18n'
import { RouteSpotViewer } from '@/components/route-spot-viewer'
import { useRouteSpots } from '@/hooks/use-route-spots'
import type { RouteSpot } from '@/lib/route-spots'

import { routeCoordinates, routeTypeKey, type SavedRoute } from '@/lib/saved-route-model'
import { fetchSavedRoute } from '@/lib/saved-routes'
import { formatRunDate } from '@/lib/run-history-model'
import { ROUTE_LINE_COLOR, RouteDirectionArrows } from '@/route-direction-arrows'

import { prepareRoutePublication, publicationPreview, setRoutePublication, type PublicationContext } from '@/lib/route-publication'

const FALLBACK_REGION: Region = { latitude: 35.681236, longitude: 139.767125, latitudeDelta: 0.03, longitudeDelta: 0.03 }

export default function SavedRouteDetailScreen() {
  const { session } = useAuth(); const { t, locale } = useI18n(); const { id } = useLocalSearchParams<{ id: string }>()
  const [arrowRegion, setArrowRegion] = useState<Region | null>(null)
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 })
  const arrowViewport = useMemo(() => arrowRegion ? { ...arrowRegion, ...mapSize } : null, [arrowRegion, mapSize])
  const mapRef = useRef<MapView>(null); const [route, setRoute] = useState<SavedRoute | null>(null); const [isLoading, setIsLoading] = useState(true); const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false); const [errorMessage, setErrorMessage] = useState('')
  const { spots, photos, failed: spotsFailed, retry: retrySpots } = useRouteSpots(id)
  const [popupSpot, setPopupSpot] = useState<RouteSpot | null>(null)
  const [selectedSpot, setSelectedSpot] = useState<RouteSpot | null>(null)
  const previewMapRef = useRef<MapView>(null)
  const [publication, setPublication] = useState<PublicationContext | null>(null)
  const [filterEnabled, setFilterEnabled] = useState(true)
  const preview = useMemo(() => publication ? publicationPreview(publication, filterEnabled) : null, [publication, filterEnabled])
  const [elevationPick, setElevationPick] = useState<{ routeId: string; fraction: number } | null>(null)
  const selectedFraction = elevationPick?.routeId === id ? elevationPick.fraction : null
  const coordinates = useMemo(() => route ? routeCoordinates(route) : [], [route])
  const selectedCoordinate = useMemo(() => selectedFraction == null ? null : coordinateAtFraction(coordinates, selectedFraction), [coordinates, selectedFraction])
  const loadRoute = useCallback(async () => {
    if (!session?.user.id || !id) return
    setIsLoading(true); setErrorMessage('')
    try { const result = await fetchSavedRoute(session.user.id, id, t); setRoute(result); if (!result) setErrorMessage(t('routeNotFound')) }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : t('routeLoadFailed')) }
    finally { setIsLoading(false) }
  }, [id, session, t])
  useFocusEffect(useCallback(() => { void loadRoute() }, [loadRoute]))
  useEffect(() => { if (coordinates.length < 2) return; const timer = setTimeout(() => mapRef.current?.fitToCoordinates(coordinates, { edgePadding: { top: 45, right: 35, bottom: 45, left: 35 }, animated: false }), 150); return () => clearTimeout(timer) }, [coordinates])
  const initialRegion = coordinates[0] ? { ...coordinates[0], latitudeDelta: 0.02, longitudeDelta: 0.02 } : FALLBACK_REGION
  const type = route ? routeTypeKey(route) : 'other'
  const typeLabel = type === 'drawn' ? t('drawnRoute') : type === 'fromRun' ? t('fromRunRoute') : route?.routeType || t('savedRoute')
  const webBase = (process.env.EXPO_PUBLIC_WEB_URL || 'https://heinekogit.github.io/cycling-book-Web').replace(/\/$/, '')
  const shareRoute = async () => { if (!route?.isPublic) return; await Share.share({ title: route.name, message: `${route.name}\n${webBase}/routes/${encodeURIComponent(route.id)}`, url: `${webBase}/routes/${encodeURIComponent(route.id)}` }) }
  const applyVisibility = async (makePublic: boolean) => {
    if (!route || isUpdatingVisibility) return
    setIsUpdatingVisibility(true)
    try {
      await setRoutePublication(route.id, makePublic, t, makePublic ? preview ?? undefined : undefined)
      setPublication(null)
      retrySpots()
      await loadRoute()
    } catch (error) { Alert.alert(t('updateFailed'), error instanceof Error ? error.message : t('unknownError')) }
    finally { setIsUpdatingVisibility(false) }
  }
  const toggleVisibility = async () => {
    if (!route || !session?.user.id || isUpdatingVisibility) return
    if (route.isPublic) {
      Alert.alert(t('makePrivate'), t('makePrivateConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('makePrivate'), onPress: () => { void applyVisibility(false) } }])
      return
    }
    setIsUpdatingVisibility(true)
    try { setPublication(await prepareRoutePublication(session.user.id, route.id, t)); setFilterEnabled(true) }
    catch (error) { Alert.alert(t('updateFailed'), error instanceof Error ? error.message : t('unknownError')) }
    finally { setIsUpdatingVisibility(false) }
  }

  return <SafeAreaView style={styles.safeArea}>
    <RouteSpotViewer spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
    <Modal visible={publication !== null} animationType="slide" onRequestClose={() => { if (!isUpdatingVisibility) setPublication(null) }}>
      <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Text style={styles.headerTitle}>{t('privacyTitle')}</Text>
        <Text style={styles.description}>{t('publishRouteConfirm')}</Text>
        <View style={styles.titleRow}><Text style={[styles.description, { flex: 1 }]}>{t('privacyFilter')}</Text><Switch accessibilityLabel={t('privacyFilter')} value={filterEnabled} disabled={isUpdatingVisibility} onValueChange={setFilterEnabled} /></View>
        {publication && preview && <MapView ref={previewMapRef} onMapReady={() => previewMapRef.current?.fitToCoordinates([...publication.points.map((point) => ({ latitude: point.lat, longitude: point.lng })), { latitude: publication.home.lat, longitude: publication.home.lng }], { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false })} style={{ height: 320 }} initialRegion={{ latitude: publication.home.lat, longitude: publication.home.lng, latitudeDelta: 0.025, longitudeDelta: 0.025 }}>
          <Circle center={{ latitude: publication.home.lat, longitude: publication.home.lng }} radius={500} strokeColor="#BD4035" fillColor="rgba(189,64,53,0.16)" />
          {preview.segments.map((segment, index) => <Polyline key={index} coordinates={segment.map((point) => ({ latitude: point.lat, longitude: point.lng }))} strokeColor={ROUTE_LINE_COLOR} strokeWidth={5} />)}
        </MapView>}
        <Text style={styles.description}>{t(filterEnabled ? 'privacyFilteredNote' : 'privacyUnfilteredNote')}</Text>
        {preview && <Text style={styles.description}>{t('privacySummary', { distance: (preview.publicDistanceM / 1000).toFixed(2), photos: preview.hiddenPhotoIds.length, markers: preview.hiddenMarkerIds.length })}</Text>}
        {!preview?.segments.length && <Text style={styles.errorText}>{t('privacyNoSegments')}</Text>}
        <Pressable disabled={isUpdatingVisibility || !preview?.segments.length} style={[styles.startButton, (isUpdatingVisibility || !preview?.segments.length) && { opacity: 0.4 }]} onPress={() => { void applyVisibility(true) }}><Text style={styles.startButtonText}>{t('publishRoute')}</Text></Pressable>
        <Pressable disabled={isUpdatingVisibility} style={styles.secondaryButton} onPress={() => setPublication(null)}><Text style={styles.secondaryButtonText}>{t('cancel')}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>{t('backToRoutes')}</Text></Pressable>
      {route && <><Text style={styles.routeName} numberOfLines={2}>{route.name}</Text><View style={styles.visibilityControls}><View style={[styles.badge, route.isPublic ? styles.publicBadge : styles.privateBadge]}><Text style={styles.badgeText}>{t(route.isPublic ? 'publicRoute' : 'privateRoute')}</Text></View><Pressable disabled={isUpdatingVisibility} style={[styles.visibilityButton, isUpdatingVisibility && { opacity: 0.5 }]} onPress={toggleVisibility}><Text style={styles.secondaryButtonText}>{t(route.isPublic ? 'makePrivate' : 'publishRoute')}</Text></Pressable></View></>}
    </View>
    {isLoading ? <View style={styles.center}><ActivityIndicator size="large" color="#245D40" /><Text style={styles.supportText}>{t('loadingRoute')}</Text></View> : errorMessage || !route ? <View style={styles.center}><Text style={styles.errorTitle}>{t('displayFailed')}</Text><Text style={styles.errorText}>{errorMessage}</Text><Pressable style={styles.retryButton} onPress={() => { void loadRoute() }}><Text style={styles.retryText}>{t('retry')}</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.distanceBar}><Text style={styles.distanceLabel}>{t('distance')}</Text><Text style={styles.distanceValue}>{(route.distanceMeters / 1000).toFixed(2)} <Text style={styles.statUnit}>km</Text></Text></View>
      <View style={styles.mapCard}>{coordinates.length ? <MapView ref={mapRef} onRegionChangeComplete={setArrowRegion} onLayout={(event) => { const { width, height } = event.nativeEvent.layout; setMapSize({ width, height }) }} style={styles.map} provider={PROVIDER_DEFAULT} initialRegion={initialRegion} onPress={(event) => { setPopupSpot(null); const distance = routeProgressMeters(event.nativeEvent.coordinate, coordinates); const total = routeDistanceMeters(coordinates); if (distance != null && total > 0) setElevationPick({ routeId: id, fraction: distance / total }) }} rotateEnabled={false} pitchEnabled={false}><Polyline coordinates={coordinates} strokeColor={ROUTE_LINE_COLOR} strokeWidth={6} /><RouteDirectionArrows coordinates={coordinates} viewport={arrowViewport} /><Marker coordinate={coordinates[0]} title={t('markerStart')} pinColor="#286F4A" />{coordinates.length > 1 && <Marker coordinate={coordinates.at(-1)!} title={t('markerEnd')} pinColor="#D2613D" />}{selectedCoordinate && <Marker coordinate={selectedCoordinate} anchor={{ x: 0.5, y: 0.5 }}><View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFF', backgroundColor: '#EF6D3F' }} /></Marker>}{spots.map((spot) => <RouteSpotMarker key={spot.id} spot={spot} onSelect={() => setPopupSpot(spot)} />)}</MapView> : <View style={styles.noMap}><Text style={styles.noMapTitle}>{t('noRouteTrack')}</Text><Text style={styles.supportText}>{t('noRouteTrackHelp')}</Text></View>}<RouteSpotPopup spot={popupSpot} onClose={() => setPopupSpot(null)} onOpenPhotos={() => setSelectedSpot(popupSpot)} /></View>
      {spotsFailed && <Pressable onPress={retrySpots}><Text style={styles.errorText}>{t('spotsLoadFailed')}</Text></Pressable>}
      <View style={styles.summary}>
        <RouteElevation route={route} selectedFraction={selectedFraction} onSelect={(fraction) => setElevationPick({ routeId: id, fraction })} />
        <Pressable style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]} onPress={() => router.push({ pathname: '/ride', params: { routeId: route.id } })}><Text style={styles.startButtonText}>{t('rideThisRoute')}</Text><Text style={styles.startButtonNote}>{t('showRouteOnRide')}</Text></Pressable>
      </View>
      <View style={styles.details}>
        <View style={styles.stats}><View><Text style={styles.statLabel}>{t('routeKind')}</Text><Text style={styles.statType}>{typeLabel}</Text></View></View>
        <Text style={styles.date}>{formatRunDate(route.createdAt, locale, t('unknownDate'))}</Text>
        {!!route.description && <Text style={styles.description}>{route.description}</Text>}
        <Pressable style={{ paddingVertical: 12 }} onPress={() => { void Linking.openURL(`${webBase}/profile`).catch(() => Alert.alert(t('updateFailed'), t('unknownError'))) }}><Text style={styles.secondaryButtonText}>{t('privacyProfile')}</Text></Pressable>
        {route.isPublic && <View style={styles.secondaryActions}><Pressable style={styles.secondaryButton} onPress={() => { void shareRoute() }}><Text style={styles.secondaryButtonText}>{t('shareRoute')}</Text></Pressable></View>}
      </View>
      {photos.length > 0 && <View style={styles.photoSection}><Text style={styles.sectionTitle}>{t('routePhotos')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>{photos.map((photo) => <Pressable key={photo.id} accessibilityRole="button" onPress={() => setSelectedSpot({ id: `photo:${photo.id}`, latitude: photo.latitude, longitude: photo.longitude, comment: spots.find((spot) => spot.photos.some((item) => item.id === photo.id))?.comment ?? '', photos: [photo], isPrivacyHidden: photo.isPrivacyHidden === true })}><Image source={{ uri: photo.thumbUrl || photo.imageUrl }} style={styles.photo} accessibilityLabel={t('routePhoto')} /></Pressable>)}</ScrollView></View>}
    </ScrollView>}
  </SafeAreaView>
}

const styles = StyleSheet.create({
  distanceBar: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#FFF' }, distanceLabel: { color: '#738078', fontSize: 12 }, distanceValue: { color: '#1E3024', fontSize: 18, fontWeight: '800' },
  visibilityControls: { flexDirection: 'row', alignItems: 'center', gap: 6 }, visibilityButton: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#AFC7B5', borderRadius: 10, backgroundColor: '#F5FAF5' },
  safeArea: { flex: 1, backgroundColor: '#F2F5F1' }, header: { minHeight: 68, paddingVertical: 10, gap: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E1D9', backgroundColor: '#FFF' }, back: { width: 62, paddingVertical: 10 }, backText: { color: '#246A47', fontSize: 14, fontWeight: '700' }, headerTitle: { flex: 1, color: '#17251B', fontSize: 17, fontWeight: '800', textAlign: 'center' }, headerSpacer: { width: 85 }, content: { paddingBottom: 36 }, mapCard: { height: 300, backgroundColor: '#DCE5DD' }, map: { flex: 1 }, noMap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }, noMapTitle: { color: '#425247', fontSize: 16, fontWeight: '800' }, summary: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16, backgroundColor: '#FFF' }, details: { marginTop: 12, paddingHorizontal: 18, paddingBottom: 16, backgroundColor: '#FFF' }, titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, routeName: { flex: 1, color: '#192A1E', fontSize: 18, fontWeight: '900' }, badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 }, publicBadge: { backgroundColor: '#DDF1E3' }, privateBadge: { backgroundColor: '#ECEFEC' }, badgeText: { color: '#53665A', fontSize: 9, fontWeight: '800' }, date: { marginTop: 6, color: '#738078', fontSize: 11 }, description: { marginTop: 14, color: '#56645B', fontSize: 13, lineHeight: 20 }, stats: { marginTop: 21, paddingVertical: 17, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#E0E6E0', flexDirection: 'row', justifyContent: 'space-between' }, statLabel: { marginBottom: 5, color: '#7B867E', fontSize: 10, fontWeight: '700' }, statValue: { color: '#1E3024', fontSize: 21, fontWeight: '900' }, statUnit: { color: '#69756D', fontSize: 10 }, statType: { color: '#34483A', fontSize: 13, fontWeight: '800', textAlign: 'right' }, elevation: { paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, elevationValue: { color: '#2E4937', fontSize: 13, fontWeight: '800' }, secondaryActions: { flexDirection: 'row', gap: 9 }, secondaryButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#AFC7B5', borderRadius: 12, backgroundColor: '#F5FAF5' }, secondaryButtonText: { color: '#286044', fontSize: 11, fontWeight: '800' }, startButton: { marginTop: 12, minHeight: 58, borderRadius: 15, backgroundColor: '#173F2B', alignItems: 'center', justifyContent: 'center' }, startButtonPressed: { opacity: 0.8 }, startButtonText: { color: '#FFF', fontSize: 14, fontWeight: '900' }, startButtonNote: { marginTop: 3, color: '#B7CCBD', fontSize: 9 }, photoSection: { marginTop: 16, paddingVertical: 18, backgroundColor: '#FFF', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#DCE4DC' }, sectionTitle: { paddingHorizontal: 18, marginBottom: 12, color: '#173F2B', fontSize: 16, fontWeight: '900' }, photoRow: { paddingHorizontal: 18, gap: 10 }, photo: { width: 190, height: 130, borderRadius: 14, backgroundColor: '#E4EAE4' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, supportText: { marginTop: 10, color: '#7A857D', fontSize: 12, lineHeight: 19, textAlign: 'center' }, errorTitle: { color: '#8F3D29', fontSize: 17, fontWeight: '800' }, errorText: { marginTop: 9, color: '#765D56', fontSize: 12, lineHeight: 18, textAlign: 'center' }, retryButton: { marginTop: 20, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, backgroundColor: '#245D40' }, retryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
})
