import { useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useI18n } from '@/i18n'
import type { RouteSpot } from '@/lib/route-spots'

function SpotImage({ uri }: { uri: string }) {
  const { t } = useI18n()
  const [failed, setFailed] = useState(false)
  return failed ? <Text style={styles.note}>{t('spotImageFailed')}</Text> : <Image source={{ uri }} resizeMode="contain" style={styles.image} onError={() => setFailed(true)} accessibilityLabel={t('routePhoto')} />
}

export function RouteSpotViewer({ spot, onClose }: { spot: RouteSpot | null; onClose: () => void }) {
  const { t } = useI18n()
  return <Modal visible={spot !== null} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}><Text style={styles.title}>{t('routeSpot')}</Text><Pressable accessibilityRole="button" onPress={onClose} style={styles.close}><Text style={styles.closeText}>{t('close')}</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content}>
        {spot?.isPrivacyHidden && <Text style={styles.note}>{t('spotPrivate')}</Text>}
        {!!spot?.comment && <Text selectable style={styles.comment}>{spot.comment}</Text>}
        {!spot?.comment && !spot?.photos.length && <Text style={styles.note}>{t('spotEmpty')}</Text>}
        {spot?.photos.map((photo) => <View key={photo.id}><SpotImage key={photo.imageUrl} uri={photo.imageUrl} />{photo.isPrivacyHidden && !spot.isPrivacyHidden && <Text style={styles.note}>{t('spotPrivate')}</Text>}</View>)}
      </ScrollView>
    </SafeAreaView>
  </Modal>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F2F5F1' }, header: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 20, fontWeight: '800', color: '#173F2B' }, close: { padding: 12 }, closeText: { color: '#246A47', fontWeight: '700' }, content: { padding: 18, gap: 16 }, comment: { fontSize: 17, lineHeight: 26, color: '#243B2D' }, note: { color: '#765D56', padding: 12 }, image: { width: '100%', height: 320, backgroundColor: '#E2E9E2', borderRadius: 12 },
})
