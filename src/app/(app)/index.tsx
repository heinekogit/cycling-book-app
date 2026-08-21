import * as Linking from 'expo-linking'
import { useEffect, useRef } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/auth'
import { useRideRecorder } from '@/hooks/use-ride-recorder'

const DEFAULT_REGION: Region = { latitude: 35.681236, longitude: 139.767125, latitudeDelta: 0.03, longitudeDelta: 0.03 }
const formatTime = (seconds: number) => [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':')

export default function RideScreen() {
  const { session, signOut } = useAuth()
  const mapRef = useRef<MapView>(null)
  const {
    rideState, draft, elapsedSeconds, speedKmh, distanceMeters, message,
    hasUnsavedRide, permissionIssue, start, pause, finishAndSave, resetFinishedRide,
  } = useRideRecorder(session)

  useEffect(() => {
    if (!draft?.currentPoint) return
    mapRef.current?.animateCamera({ center: draft.currentPoint, zoom: 17 }, { duration: 500 })
  }, [draft?.currentPoint])

  const confirmFinish = () => {
    Alert.alert('走行を終了しますか？', '現在までの実走ログを終了して保存します。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '終了・保存', style: 'destructive', onPress: finishAndSave },
    ])
  }

  const startAnotherRide = () => {
    if (!hasUnsavedRide) {
      resetFinishedRide()
      void start()
      return
    }
    Alert.alert('未保存の記録があります', '端末内の記録を破棄して新しく開始しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '破棄して開始', style: 'destructive', onPress: () => { void start(true) } },
    ])
  }

  const currentPoint = draft?.currentPoint
  const track = draft?.points ?? []
  const isRecording = rideState === 'riding'
  const isBusy = rideState === 'locating' || rideState === 'saving'
  const canFinish = ['riding', 'paused', 'finished'].includes(rideState) && hasUnsavedRide

  return <View style={styles.screen}>
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} provider={PROVIDER_DEFAULT} initialRegion={DEFAULT_REGION} showsCompass showsScale>
      {track.length > 1 && <Polyline coordinates={track} strokeColor="#2B7950" strokeWidth={6} />}
      {currentPoint && <Marker coordinate={currentPoint} anchor={{ x: 0.5, y: 0.5 }}><View style={styles.currentMarker}><View style={styles.currentMarkerCore} /></View></Marker>}
    </MapView>
    <SafeAreaView style={styles.overlay} pointerEvents="box-none">
      <View style={styles.header}><View><Text style={styles.brand}>Cycling Book</Text><Text style={styles.subtitle}>実走記録</Text></View><Pressable onPress={signOut} disabled={hasUnsavedRide}><Text style={[styles.signOut, hasUnsavedRide && styles.signOutDisabled]}>ログアウト</Text></Pressable></View>
      <View style={styles.mapNotice}>
        {isBusy && <ActivityIndicator color="#2B7950" size="small" />}
        <View style={styles.noticeCopy}>
          <Text style={styles.mapNoticeTitle}>{message}</Text>
          <Text style={styles.mapNoticeText}>{currentPoint ? `精度 ±${Math.round(currentPoint.accuracy)}m・記録 ${track.length}点` : '位置情報待ち'}</Text>
          {permissionIssue && <Pressable onPress={() => { void Linking.openSettings() }}><Text style={styles.settingsLink}>iPhoneの設定を開く</Text></Pressable>}
        </View>
      </View>
      <View style={styles.spacer} />
      <View style={styles.panel}>
        <Text style={styles.account} numberOfLines={1}>{session?.user.email}</Text>
        <View style={styles.metrics}><View style={[styles.metric, styles.metricWide]}><Text style={styles.metricLabel}>経過時間</Text><Text style={styles.metricValue}>{formatTime(elapsedSeconds)}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>距離</Text><Text style={styles.metricValue}>{(distanceMeters / 1000).toFixed(2)}<Text style={styles.unit}> km</Text></Text></View><View style={styles.metric}><Text style={styles.metricLabel}>速度</Text><Text style={styles.metricValue}>{speedKmh.toFixed(1)}<Text style={styles.unit}> km/h</Text></Text></View></View>
        <View style={styles.actions}>
          {isRecording
            ? <Pressable style={[styles.action, styles.pause]} onPress={pause}><Text style={styles.actionText}>Ⅱ　一時停止</Text></Pressable>
            : <Pressable style={[styles.action, styles.start, isBusy && styles.disabled]} onPress={rideState === 'finished' && hasUnsavedRide ? finishAndSave : rideState === 'finished' ? startAnotherRide : () => { void start() }} disabled={isBusy}><Text style={styles.actionText}>▶　{rideState === 'paused' ? '再開' : rideState === 'finished' && hasUnsavedRide ? '保存を再試行' : rideState === 'finished' ? 'もう一度開始' : '開始'}</Text></Pressable>}
          <Pressable style={[styles.action, styles.finish, !canFinish && styles.disabled]} disabled={!canFinish || isBusy} onPress={confirmFinish}><Text style={styles.finishText}>■　終了・保存</Text></Pressable>
        </View>
        <Text style={styles.note}>走行中はSQLiteへ自動退避します。保存失敗時も端末内データを保持します。</Text>
      </View>
    </SafeAreaView>
  </View>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#DFE8DD' }, overlay: { flex: 1 }, header: { marginHorizontal: 12, padding: 13, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: '#173F2B', fontSize: 16, fontWeight: '800' }, subtitle: { marginTop: 2, color: '#738078', fontSize: 11, fontWeight: '600' }, signOut: { color: '#657168', fontSize: 11, fontWeight: '700' }, signOutDisabled: { opacity: 0.35 },
  mapNotice: { marginTop: 10, marginHorizontal: 18, alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', gap: 9 }, noticeCopy: { flexShrink: 1 }, mapNoticeTitle: { color: '#2B3A30', fontSize: 11, fontWeight: '800' }, mapNoticeText: { marginTop: 2, color: '#758078', fontSize: 10 }, settingsLink: { marginTop: 7, color: '#246A47', fontSize: 11, fontWeight: '800', textDecorationLine: 'underline' }, spacer: { flex: 1 }, currentMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#173F2B', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } }, currentMarkerCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF6D3F' },
  panel: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFF' }, account: { marginBottom: 13, color: '#89938C', fontSize: 10, textAlign: 'center' }, metrics: { flexDirection: 'row' }, metric: { flex: 1, alignItems: 'center', paddingHorizontal: 5, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E5E9E5' }, metricWide: { flex: 1.35, borderLeftWidth: 0 }, metricLabel: { marginBottom: 5, color: '#79837C', fontSize: 10, fontWeight: '700' }, metricValue: { color: '#17221B', fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }, unit: { color: '#68746C', fontSize: 9 }, actions: { marginTop: 21, flexDirection: 'row', gap: 10 }, action: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, start: { flex: 1.7, backgroundColor: '#173F2B' }, pause: { flex: 1.7, backgroundColor: '#D59622' }, finish: { flex: 1, borderWidth: 1, borderColor: '#E4CFC8', backgroundColor: '#FFF4F0' }, disabled: { opacity: 0.45 }, actionText: { color: '#FFF', fontSize: 13, fontWeight: '800' }, finishText: { color: '#B74726', fontSize: 12, fontWeight: '800' }, note: { marginTop: 10, color: '#8A948D', fontSize: 9, lineHeight: 13, textAlign: 'center' },
})
