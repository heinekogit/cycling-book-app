import { type Href, router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/auth'
import { useI18n } from '@/i18n'
import { routeTypeKey, type SavedRoute } from '@/lib/saved-route-model'
import { fetchSavedRoutes } from '@/lib/saved-routes'
import { formatRunDate } from '@/lib/run-history-model'

export default function RoutesScreen() {
  const { session } = useAuth()
  const { t, locale } = useI18n()
  const [routes, setRoutes] = useState<SavedRoute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadRoutes = useCallback(async (refresh = false) => {
    if (!session?.user.id) return
    if (refresh) setIsRefreshing(true); else setIsLoading(true)
    setErrorMessage('')
    try { setRoutes(await fetchSavedRoutes(session.user.id, t)) }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : t('routesLoadFailed')) }
    finally { setIsLoading(false); setIsRefreshing(false) }
  }, [session, t])

  useFocusEffect(useCallback(() => { void loadRoutes() }, [loadRoutes]))

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>{t('backToHome')}</Text></Pressable><Text style={styles.headerTitle}>{t('myRoutes')}</Text><View style={styles.headerSpacer} /></View>
    {isLoading
      ? <View style={styles.center}><ActivityIndicator size="large" color="#245D40" /><Text style={styles.supportText}>{t('loadingRoutes')}</Text></View>
      : errorMessage
        ? <View style={styles.center}><Text style={styles.errorTitle}>{t('routesLoadFailed')}</Text><Text style={styles.errorText}>{errorMessage}</Text><Pressable style={styles.retryButton} onPress={() => { void loadRoutes() }}><Text style={styles.retryText}>{t('retry')}</Text></Pressable></View>
        : <FlatList data={routes} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, routes.length === 0 && styles.emptyList]} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { void loadRoutes(true) }} tintColor="#245D40" />} ListHeaderComponent={<Text style={styles.intro}>{t('routeListHelp')}</Text>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>{t('noSavedRoutes')}</Text><Text style={styles.supportText}>{t('noSavedRoutesHelp')}</Text></View>} renderItem={({ item }) => <RouteCard route={item} locale={locale} />} />}
  </SafeAreaView>
}

function RouteCard({ route, locale }: { route: SavedRoute; locale: string }) {
  const { t } = useI18n()
  const type = routeTypeKey(route)
  const typeLabel = type === 'drawn' ? t('drawnRoute') : type === 'fromRun' ? t('fromRunRoute') : route.routeType || t('savedRoute')
  return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={() => router.push(`/routes/${encodeURIComponent(route.id)}` as Href)}>
    <View style={styles.cardHeading}><Text style={styles.cardTitle} numberOfLines={1}>{route.name}</Text><View style={[styles.visibility, route.isPublic ? styles.publicBadge : styles.privateBadge]}><Text style={styles.visibilityText}>{t(route.isPublic ? 'publicRoute' : 'privateRoute')}</Text></View></View>
    <Text style={styles.cardDate}>{formatRunDate(route.createdAt, locale, t('unknownDate'))}</Text>
    <View style={styles.cardFooter}><Text style={styles.distance}>{(route.distanceMeters / 1000).toFixed(2)} <Text style={styles.unit}>km</Text></Text><Text style={styles.type}>{typeLabel}</Text><Text style={styles.chevron}>›</Text></View>
  </Pressable>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F5F1' }, header: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E1D9', backgroundColor: '#FFF' }, back: { width: 85, paddingVertical: 10 }, backText: { color: '#246A47', fontSize: 14, fontWeight: '700' }, headerTitle: { flex: 1, color: '#17251B', fontSize: 17, fontWeight: '800', textAlign: 'center' }, headerSpacer: { width: 85 },
  list: { padding: 16, paddingBottom: 36 }, emptyList: { flexGrow: 1 }, intro: { marginBottom: 14, color: '#718078', fontSize: 12, lineHeight: 18 }, card: { marginBottom: 12, padding: 17, borderWidth: 1, borderColor: '#D9E2D9', borderRadius: 18, backgroundColor: '#FFF' }, pressed: { opacity: 0.75 }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, cardTitle: { flex: 1, color: '#1B2C20', fontSize: 16, fontWeight: '900' }, visibility: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99 }, publicBadge: { backgroundColor: '#DDF1E3' }, privateBadge: { backgroundColor: '#ECEFEC' }, visibilityText: { color: '#496253', fontSize: 9, fontWeight: '800' }, cardDate: { marginTop: 6, color: '#7B877F', fontSize: 10 }, cardFooter: { marginTop: 16, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E3E8E3', flexDirection: 'row', alignItems: 'center' }, distance: { color: '#203126', fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] }, unit: { color: '#6E7A72', fontSize: 10 }, type: { flex: 1, marginLeft: 17, color: '#738078', fontSize: 11 }, chevron: { color: '#83A08C', fontSize: 26 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { marginBottom: 8, color: '#26372B', fontSize: 17, fontWeight: '800', textAlign: 'center' }, supportText: { marginTop: 10, color: '#7A857D', fontSize: 12, lineHeight: 19, textAlign: 'center' }, errorTitle: { color: '#8F3D29', fontSize: 17, fontWeight: '800' }, errorText: { marginTop: 9, color: '#765D56', fontSize: 12, lineHeight: 18, textAlign: 'center' }, retryButton: { marginTop: 20, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, backgroundColor: '#245D40' }, retryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
})
