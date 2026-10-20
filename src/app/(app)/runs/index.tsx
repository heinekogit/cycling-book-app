import { type Href, router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'

import { useAuth } from '@/auth'
import { fetchRuns } from '@/lib/run-history'
import { averageSpeedKmh, formatDuration, formatRunDate, type RunSummary } from '@/lib/run-history-model'
import { useI18n } from '@/i18n'

export default function RunHistoryScreen() {
  const { t, locale } = useI18n()
  const { session } = useAuth()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadRuns = useCallback(async (refresh = false) => {
    if (!session?.user.id) return
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    setErrorMessage('')
    try {
      setRuns(await fetchRuns(session.user.id, t))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('historyLoadFailed'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [session, t])

  useFocusEffect(useCallback(() => { void loadRuns() }, [loadRuns]))

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable style={styles.headerButton} onPress={() => router.back()}><Text style={styles.headerButtonText}>{t('backToRide')}</Text></Pressable>
      <Text style={styles.headerTitle}>{t('rideHistory')}</Text>
      <View style={styles.headerSpacer} />
    </View>

    {isLoading
      ? <View style={styles.center}><ActivityIndicator size="large" color="#245D40" /><Text style={styles.supportText}>{t('loadingHistory')}</Text></View>
      : errorMessage
        ? <View style={styles.center}><Text style={styles.errorTitle}>{t('historyLoadFailed')}</Text><Text style={styles.errorText}>{errorMessage}</Text><Pressable style={styles.retryButton} onPress={() => { void loadRuns() }}><Text style={styles.retryText}>{t('retry')}</Text></Pressable></View>
        : <FlatList
            data={runs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, runs.length === 0 && styles.emptyList]}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { void loadRuns(true) }} tintColor="#245D40" />}
            ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{t('noSavedRuns')}</Text><Text style={styles.supportText}>{t('noSavedRunsHelp')}</Text></View>}
            renderItem={({ item }) => <RunCard run={item} locale={locale} />}
          />}
  </SafeAreaView>
}

function RunCard({ run, locale }: { run: RunSummary; locale: string }) {
  const { t } = useI18n()
  const averageSpeed = averageSpeedKmh(run.distanceMeters, run.durationSeconds)
  const open = () => router.push(`/runs/${encodeURIComponent(run.id)}` as Href)
  return <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={open}>
    <View style={styles.cardHeading}>
      <View style={styles.cardTitleBlock}><View style={styles.titleRow}><Text style={styles.cardTitle} numberOfLines={1}>{run.name}</Text>{run.hasPhotos && <View style={styles.photoIcon} accessibilityLabel={t('hasPhotos')}><Svg width={15} height={15} viewBox="0 0 24 24"><Path fill="#2B7950" d="M8.5 5.5 10 3h4l1.5 2.5H19a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8.5a3 3 0 0 1 3-3h3.5ZM12 18a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-2a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" /></Svg></View>}</View><Text style={styles.cardDate}>{formatRunDate(run.startedAt, locale, t('unknownDate'))}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </View>
    <View style={styles.metrics}>
      <Metric label={t('distance')} value={(run.distanceMeters / 1000).toFixed(2)} unit="km" />
      <Metric label={t('duration')} value={formatDuration(run.durationSeconds)} />
      <Metric label={t('averageSpeed')} value={averageSpeed.toFixed(1)} unit="km/h" />
    </View>
  </Pressable>
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}{unit && <Text style={styles.metricUnit}> {unit}</Text>}</Text></View>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F5F1' }, header: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E1D9', backgroundColor: '#FFF' }, headerButton: { width: 80, paddingVertical: 10 }, headerButtonText: { color: '#246A47', fontSize: 15, fontWeight: '700' }, headerTitle: { flex: 1, color: '#17251B', fontSize: 17, fontWeight: '800', textAlign: 'center' }, headerSpacer: { width: 80 },
  list: { padding: 16, paddingBottom: 36 }, emptyList: { flexGrow: 1 }, card: { marginBottom: 12, padding: 17, borderWidth: 1, borderColor: '#DBE3DB', borderRadius: 18, backgroundColor: '#FFF' }, cardPressed: { opacity: 0.75 }, cardHeading: { flexDirection: 'row', alignItems: 'center' }, cardTitleBlock: { flex: 1 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cardTitle: { flexShrink: 1, color: '#1B2C20', fontSize: 16, fontWeight: '800' }, photoIcon: { width: 28, height: 28, flexShrink: 0, borderRadius: 14, backgroundColor: '#E7F3E8', alignItems: 'center', justifyContent: 'center' }, cardDate: { marginTop: 5, color: '#738078', fontSize: 11 }, chevron: { color: '#83A08C', fontSize: 28 }, metrics: { marginTop: 17, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E3E8E3', flexDirection: 'row' }, metric: { flex: 1 }, metricLabel: { marginBottom: 5, color: '#7A857D', fontSize: 10, fontWeight: '700' }, metricValue: { color: '#203126', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] }, metricUnit: { color: '#69756D', fontSize: 9 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { marginBottom: 8, color: '#26372B', fontSize: 17, fontWeight: '800', textAlign: 'center' }, supportText: { marginTop: 10, color: '#7A857D', fontSize: 12, lineHeight: 19, textAlign: 'center' }, errorTitle: { color: '#8F3D29', fontSize: 17, fontWeight: '800' }, errorText: { marginTop: 9, color: '#765D56', fontSize: 12, lineHeight: 18, textAlign: 'center' }, retryButton: { marginTop: 20, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, backgroundColor: '#245D40' }, retryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
})
