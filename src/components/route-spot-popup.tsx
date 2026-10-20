import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useI18n } from '@/i18n'
import type { RouteSpot } from '@/lib/route-spots'

// A React overlay outside MapView: native marker deselection and GPS redraws
// must not control its lifetime or forward taps to the photo viewer.
export function RouteSpotPopup({ spot, onClose, onOpenPhotos, top = 12 }: {
  spot: RouteSpot | null; onClose: () => void; onOpenPhotos: () => void; top?: number
}) {
  const { t } = useI18n()
  if (!spot) return null
  return <View style={[styles.popup, { top }]}>
    <View style={styles.header}><Text style={styles.title}>{t('routeSpot')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
    <ScrollView style={styles.body} nestedScrollEnabled contentContainerStyle={styles.content}>
      {!!spot.comment && <Text selectable style={styles.comment}>{spot.comment}</Text>}
      {!spot.comment && !spot.photos.length && <Text style={styles.comment}>{t('spotEmpty')}</Text>}
      {spot.isPrivacyHidden && <Text style={styles.note}>{t('spotPrivate')}</Text>}
      <View style={styles.photos}>{spot.photos.map((photo) => <Image key={photo.id} source={{ uri: photo.thumbUrl || photo.imageUrl }} style={styles.photo} accessibilityLabel={t('routePhoto')} />)}</View>
      {spot.photos.length > 0 && <Pressable accessibilityRole="button" onPress={onOpenPhotos} style={styles.button}><Text style={styles.link}>{t('spotOpenPhotos', { count: spot.photos.length })}</Text></Pressable>}
    </ScrollView>
  </View>
}
const styles = StyleSheet.create({
  popup: { position: 'absolute', left: 18, right: 18, maxWidth: 360, alignSelf: 'center', zIndex: 20, elevation: 8, borderRadius: 14, backgroundColor: '#fff', shadowColor: '#173f2b', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14 }, title: { color: '#173f2b', fontWeight: '700' }, close: { padding: 10, minWidth: 44, alignItems: 'center' }, closeText: { fontSize: 23, color: '#365c44' },
  body: { maxHeight: 210 }, content: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 }, comment: { fontSize: 14, lineHeight: 21, color: '#243b2d' }, note: { fontSize: 11, color: '#765d56' }, photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, photo: { width: 76, height: 60, borderRadius: 5, backgroundColor: '#e2e9e2' }, button: { paddingVertical: 12 }, link: { fontSize: 13, fontWeight: '700', color: '#246a47' },
})
