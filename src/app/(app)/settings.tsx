import { type Href, router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/auth'
import { useI18n } from '@/i18n'
import { getSavePhotosToDeviceLibrary, setSavePhotosToDeviceLibrary } from '@/lib/device-photo-library'
import { loadRideDraft } from '@/lib/ride-storage'
import { pendingRideCount } from '@/lib/ride-sync'

export default function SettingsScreen() {
  const { session } = useAuth()
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [openingDeletion, setOpeningDeletion] = useState(false)
  useFocusEffect(useCallback(() => { void getSavePhotosToDeviceLibrary().then(setEnabled) }, []))

  const changeSetting = async (value: boolean) => {
    if (busy) return
    setBusy(true)
    try {
      const saved = await setSavePhotosToDeviceLibrary(value)
      if (saved) setEnabled(value)
      else Alert.alert(t('photoLibraryPermissionDenied'))
    } catch {
      Alert.alert(t('photoLibrarySettingFailed'))
    } finally {
      setBusy(false)
    }
  }

  const openAccountDeletion = async () => {
    if (openingDeletion) return
    setOpeningDeletion(true)
    try {
      const [draft, pending] = await Promise.all([
        loadRideDraft(),
        session?.user.id ? pendingRideCount(session.user.id) : Promise.resolve(0),
      ])
      if (draft || pending > 0) {
        Alert.alert(t('deleteAccountLocalPendingTitle'), t('deleteAccountLocalPending'))
        return
      }
      const webBase = (process.env.EXPO_PUBLIC_WEB_URL || 'https://heinekogit.github.io/cycling-book-Web').replace(/\/$/, '')
      await Linking.openURL(`${webBase}/delete-account`)
    } catch {
      Alert.alert(t('deleteAccountOpenFailed'))
    } finally {
      setOpeningDeletion(false)
    }
  }

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.replace('/' as Href)}><Text style={styles.back}>{t('backToHome')}</Text></Pressable>
    <Text style={styles.title}>{t('settings')}</Text>
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.label}>{t('saveToDeviceLibrary')}</Text>
        <Text style={styles.help}>{t('saveToDeviceLibraryHelp')}</Text>
      </View>
      <Switch accessibilityLabel={t('saveToDeviceLibrary')} value={enabled} onValueChange={(value) => { void changeSetting(value) }} disabled={busy} trackColor={{ true: '#317650' }} />
    </View>
    <View style={[styles.card, styles.deletionCard]}>
      <View style={styles.copy}>
        <Text style={styles.label}>{t('deleteAccountLink')}</Text>
        <Text style={styles.help}>{t('deleteAccountLinkHelp')}</Text>
      </View>
      <Pressable accessibilityRole="link" disabled={openingDeletion} onPress={() => { void openAccountDeletion() }}>
        <Text style={styles.deletionLink}>{t('deleteAccountOpen')}</Text>
      </Pressable>
    </View>
  </ScrollView></SafeAreaView>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF3EC' },
  content: { padding: 20 },
  back: { color: '#317650', fontSize: 15, fontWeight: '700' },
  title: { marginTop: 22, marginBottom: 22, color: '#173F2B', fontSize: 27, fontWeight: '900' },
  card: { padding: 18, borderRadius: 18, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1 },
  label: { color: '#173F2B', fontSize: 16, fontWeight: '800' },
  help: { marginTop: 6, color: '#657168', fontSize: 12, lineHeight: 18 },
  deletionCard: { marginTop: 16, alignItems: 'flex-start', flexDirection: 'column' },
  deletionLink: { color: '#9D3030', fontSize: 13, fontWeight: '800', paddingVertical: 8 },
})
