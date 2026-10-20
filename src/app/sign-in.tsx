import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n'

export default function SignInScreen() {
  const { t, toggleLanguage } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const signIn = async () => {
    if (!email.trim() || !password) { setErrorMessage(t('missingCredentials')); return }
    setIsSubmitting(true); setErrorMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setIsSubmitting(false)
    if (error) { setErrorMessage(t('signInFailed')); return }
    router.replace('/')
  }
  return <SafeAreaView style={styles.safeArea}><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.card}>
      <Image source={require('../../logo.png')} style={styles.brandMark} resizeMode="contain" accessibilityLabel="Cycling Book" />
      <Pressable style={styles.languageButton} onPress={toggleLanguage}><Text style={styles.languageButtonText}>{t('switchLanguage')}</Text></Pressable>
      <Text style={styles.eyebrow}>CYCLING BOOK</Text><Text style={styles.title}>{t('signIn')}</Text>
      <Text style={styles.description}>{t('signInDescription')}</Text>
      <View style={styles.form}>
        <Text style={styles.label}>{t('email')}</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!isSubmitting} />
        <Text style={styles.label}>{t('password')}</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!isSubmitting} onSubmitEditing={signIn} />
        {!!errorMessage && <Text style={styles.error} accessibilityRole="alert">{errorMessage}</Text>}
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, isSubmitting && styles.buttonDisabled]} onPress={signIn} disabled={isSubmitting}>{isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{t('signIn')}</Text>}</Pressable>
      </View>
    </View>
  </KeyboardAvoidingView></SafeAreaView>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8EFE7' }, keyboard: { flex: 1, justifyContent: 'center', padding: 22 }, card: { padding: 28, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D9E2D9' }, languageButton: { position: 'absolute', top: 20, right: 20, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#E9F1EB' }, languageButtonText: { color: '#245D40', fontSize: 11, fontWeight: '800' },
  brandMark: { width: 96, height: 96, marginBottom: 28 }, eyebrow: { color: '#2B7950', fontSize: 10, fontWeight: '800', letterSpacing: 2 }, title: { marginTop: 7, color: '#17221B', fontSize: 32, fontWeight: '800' }, description: { marginTop: 10, color: '#68746C', fontSize: 13, lineHeight: 20 },
  form: { marginTop: 28 }, label: { marginBottom: 7, color: '#445047', fontSize: 12, fontWeight: '700' }, input: { height: 50, marginBottom: 17, paddingHorizontal: 14, borderWidth: 1, borderColor: '#CCD6CD', borderRadius: 12, backgroundColor: '#FBFCFB', color: '#17221B', fontSize: 16 }, error: { marginBottom: 14, padding: 11, borderRadius: 9, backgroundColor: '#FFF0EC', color: '#A53D25', fontSize: 12, lineHeight: 18 }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#173F2B' }, buttonPressed: { opacity: 0.85 }, buttonDisabled: { opacity: 0.6 }, buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
})
