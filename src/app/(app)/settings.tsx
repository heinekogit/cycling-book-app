import { type Href, router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useI18n } from '@/i18n'
import { getSavePhotosToDeviceLibrary, setSavePhotosToDeviceLibrary } from '@/lib/device-photo-library'

export default function SettingsScreen() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
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
})
