import { elevationSelection } from '@/lib/elevation-selection'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { ElevationChart } from '@/components/elevation-chart'
import { useI18n } from '@/i18n'
import { elevationProfileFromRecord, generateElevationProfile, type ElevationProfile } from '@/lib/elevation'
import { routeCoordinates, type SavedRoute } from '@/lib/saved-route-model'

export function RouteElevation({ route, selectedFraction, onSelect }: { route: SavedRoute; selectedFraction: number | null; onSelect: (fraction: number) => void }) {
  const { t } = useI18n()
  const stored = useMemo(() => elevationProfileFromRecord({ elevation_profile: route.elevationProfile, elevation_gain_m: route.elevationGainMeters, elevation_loss_m: route.elevationLossMeters, elevation_min_m: route.elevationMinMeters, elevation_max_m: route.elevationMaxMeters }), [route])
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ route: SavedRoute; attempt: number; profile: ElevationProfile | null } | null>(null)
  useEffect(() => {
    if (stored) return
    let active = true
    generateElevationProfile(routeCoordinates(route)).then((profile) => {
      if (active) setResult({ route, attempt, profile })
    }).catch(() => { if (active) setResult({ route, attempt, profile: null }) })
    return () => { active = false }
  }, [route, stored, attempt])
  const loaded = result?.route === route && result.attempt === attempt
  const profile = stored ?? (loaded ? result.profile : null)
  const selection = profile && selectedFraction != null ? elevationSelection(profile, selectedFraction) : null
  return <View style={styles.section}>
    <View style={styles.heading}><Text style={styles.title}>{t('elevationProfile')}</Text><View style={styles.metrics}><View><Text style={styles.text}>{t('elevationGain')}</Text><Text style={styles.value}>{profile ? Math.round(profile.gain) : route.elevationGainMeters != null ? Math.round(route.elevationGainMeters) : '—'} m</Text></View><View><Text style={styles.text}>{t('elevationLoss')}</Text><Text style={styles.value}>{profile ? Math.round(profile.loss) : route.elevationLossMeters != null ? Math.round(route.elevationLossMeters) : '—'} m</Text></View></View></View>
    {profile ? <><ElevationChart profile={profile} height={145} fullWidth currentDistanceMeters={selection?.distance} currentPositionLabel={t('selectedElevationPoint')} onDistanceChange={(distance) => onSelect(distance / (profile.distances.at(-1) || 1))} />
      {selection && <Text style={styles.value}>{(selection.distance / 1000).toFixed(2)} km · {Math.round(selection.elevation)} m · {t('localGrade')} {selection.grade == null ? '—' : `${selection.grade > 0 ? '+' : ''}${selection.grade.toFixed(1)}%`}</Text>}
      <Text style={styles.hint}>{t('elevationSelectionHelp')}</Text></> : !stored && !loaded ? <View style={styles.status}><ActivityIndicator color="#2B7950" /><Text style={styles.text}>{t('loadingElevation')}</Text></View> : <View style={styles.status}><Text style={styles.text}>{t('elevationUnavailable')}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} style={styles.retry}><Text style={styles.link}>{t('retryElevation')}</Text></Pressable></View>}
  </View>
}
const styles = StyleSheet.create({ hint: { fontSize: 10, lineHeight: 15, color: '#748078', marginTop: 6 }, section: { paddingVertical: 0 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, metrics: { flexDirection: 'row', gap: 20 }, value: { color: '#2E4937', fontSize: 14, fontWeight: '800', marginTop: 3 }, title: { color: '#173F2B', fontSize: 15, fontWeight: '800' }, status: { paddingVertical: 20, alignItems: 'center', gap: 8 }, text: { color: '#748078', fontSize: 12 }, retry: { padding: 10 }, link: { color: '#246A47', fontWeight: '700' } })
