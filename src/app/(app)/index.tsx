import { type Href, router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/auth'
import { useI18n } from '@/i18n'
import { loadRideDraft } from '@/lib/ride-storage'

export default function HomeScreen() {
  const { session, signOut } = useAuth()
  const { t, toggleLanguage } = useI18n()
  const [hasActiveDraft, setHasActiveDraft] = useState(false)
  useFocusEffect(useCallback(() => { void loadRideDraft().then((draft) => setHasActiveDraft(!!draft)) }, []))

  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View><Text style={styles.brand}>Cycling Book</Text><Text style={styles.tagline}>{t('homeTagline')}</Text></View>
        <Pressable style={styles.languageButton} onPress={toggleLanguage}><Text style={styles.languageText}>{t('switchLanguage')}</Text></Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('homeEyebrow')}</Text>
        <Text style={styles.title}>{t('homeTitle')}</Text>
        <Text style={styles.description}>{t('homeDescription')}</Text>
      </View>

      {hasActiveDraft && <View style={styles.activeNotice}><View style={styles.activeDot} /><Text style={styles.activeNoticeText}>{t('activeRideNotice')}</Text></View>}

      <View style={styles.choices}>
        <Pressable disabled={hasActiveDraft} style={({ pressed }) => [styles.choice, styles.routeChoice, hasActiveDraft && styles.choiceDisabled, pressed && styles.pressed]} onPress={() => router.push('/routes' as Href)}>
          <View style={[styles.icon, styles.routeIcon]}><Text style={styles.iconText}>⌁</Text></View>
          <View style={styles.choiceCopy}><Text style={[styles.choiceTitle, styles.routeTitle]}>{t('rideWithRoute')}</Text><Text style={[styles.choiceDescription, styles.routeDescription]}>{t('rideWithRouteHelp')}</Text></View>
          <Text style={[styles.chevron, styles.routeChevron]}>›</Text>
        </Pressable>

        <Pressable style={({ pressed }) => [styles.choice, styles.freeChoice, pressed && styles.pressed]} onPress={() => router.push('/ride' as Href)}>
          <View style={[styles.icon, styles.freeIcon]}><Text style={[styles.iconText, styles.freeIconText]}>▶</Text></View>
          <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{t(hasActiveDraft ? 'returnToRide' : 'freeRide')}</Text><Text style={styles.choiceDescription}>{t(hasActiveDraft ? 'returnToRideHelp' : 'freeRideHelp')}</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <Pressable style={styles.settingsButton} onPress={() => router.push('/settings' as Href)}><Text style={styles.historyText}>{t('settings')}</Text><Text style={styles.historyChevron}>›</Text></Pressable>

      <Pressable style={styles.historyButton} onPress={() => router.push('/runs' as Href)}><Text style={styles.historyText}>{t('viewHistory')}</Text><Text style={styles.historyChevron}>›</Text></Pressable>

      <View style={styles.accountArea}>
        <Text style={styles.account} numberOfLines={1}>{session?.user.email}</Text>
        <Pressable onPress={signOut} disabled={hasActiveDraft}><Text style={[styles.signOut, hasActiveDraft && styles.disabled]}>{t('signOut')}</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF3EC' }, content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  header: { paddingTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: '#173F2B', fontSize: 19, fontWeight: '900' }, tagline: { marginTop: 2, color: '#748078', fontSize: 10, fontWeight: '600' }, languageButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, backgroundColor: '#DCE9DF' }, languageText: { color: '#245D40', fontSize: 11, fontWeight: '800' },
  hero: { paddingTop: 58, paddingBottom: 30 }, eyebrow: { color: '#2B7950', fontSize: 10, fontWeight: '900', letterSpacing: 2 }, title: { marginTop: 9, maxWidth: 310, color: '#17251B', fontSize: 35, lineHeight: 42, fontWeight: '900' }, description: { marginTop: 13, maxWidth: 330, color: '#68756C', fontSize: 13, lineHeight: 20 }, activeNotice: { marginBottom: 13, paddingHorizontal: 15, minHeight: 44, borderRadius: 13, backgroundColor: '#FFF2D6', flexDirection: 'row', alignItems: 'center' }, activeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 9, backgroundColor: '#D59622' }, activeNoticeText: { flex: 1, color: '#765815', fontSize: 11, fontWeight: '800' },
  choices: { gap: 13 }, choice: { minHeight: 112, padding: 17, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1 }, routeChoice: { backgroundColor: '#173F2B', borderColor: '#173F2B' }, freeChoice: { backgroundColor: '#FFF', borderColor: '#D6E0D7' }, choiceDisabled: { opacity: 0.35 }, pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }, icon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, routeIcon: { backgroundColor: '#2E6347' }, freeIcon: { backgroundColor: '#E5F0E7' }, iconText: { color: '#FFF', fontSize: 18, fontWeight: '900' }, freeIconText: { color: '#245D40', fontSize: 13 }, choiceCopy: { flex: 1, marginLeft: 15 }, choiceTitle: { color: '#1C2C21', fontSize: 17, fontWeight: '900' }, routeTitle: { color: '#FFF' }, choiceDescription: { marginTop: 6, color: '#748078', fontSize: 11, lineHeight: 16 }, routeDescription: { color: '#B8CABE' }, chevron: { marginLeft: 8, color: '#8BA093', fontSize: 29 }, routeChevron: { color: '#B8CABE' },
  settingsButton: { marginTop: 12, paddingHorizontal: 17, minHeight: 54, borderRadius: 15, backgroundColor: '#E0E9E0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyButton: { marginTop: 22, paddingHorizontal: 17, minHeight: 54, borderRadius: 15, backgroundColor: '#E0E9E0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, historyText: { color: '#31513D', fontSize: 13, fontWeight: '800' }, historyChevron: { color: '#62806D', fontSize: 24 },
  accountArea: { marginTop: 'auto', paddingTop: 40, alignItems: 'center' }, account: { color: '#89938C', fontSize: 10 }, signOut: { marginTop: 13, padding: 8, color: '#657168', fontSize: 11, fontWeight: '700' }, disabled: { opacity: 0.35 },
})
