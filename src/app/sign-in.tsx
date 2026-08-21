import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const signIn = async () => {
    if (!email.trim() || !password) { setErrorMessage('メールアドレスとパスワードを入力してください'); return }
    setIsSubmitting(true); setErrorMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setIsSubmitting(false)
    if (error) { setErrorMessage('ログインできませんでした。入力内容を確認してください。'); return }
    router.replace('/')
  }
  return <SafeAreaView style={styles.safeArea}><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.card}>
      <View style={styles.brandMark}><Text style={styles.brandMarkText}>CB</Text></View>
      <Text style={styles.eyebrow}>CYCLING BOOK</Text><Text style={styles.title}>ログイン</Text>
      <Text style={styles.description}>実走ログを記録・保存するには、登録済みのアカウントでログインしてください。</Text>
      <View style={styles.form}>
        <Text style={styles.label}>メールアドレス</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!isSubmitting} />
        <Text style={styles.label}>パスワード</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!isSubmitting} onSubmitEditing={signIn} />
        {!!errorMessage && <Text style={styles.error} accessibilityRole="alert">{errorMessage}</Text>}
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, isSubmitting && styles.buttonDisabled]} onPress={signIn} disabled={isSubmitting}>{isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>ログイン</Text>}</Pressable>
      </View>
    </View>
  </KeyboardAvoidingView></SafeAreaView>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#E8EFE7' }, keyboard: { flex: 1, justifyContent: 'center', padding: 22 }, card: { padding: 28, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D9E2D9' },
  brandMark: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#173F2B', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }, brandMarkText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 }, eyebrow: { color: '#2B7950', fontSize: 10, fontWeight: '800', letterSpacing: 2 }, title: { marginTop: 7, color: '#17221B', fontSize: 32, fontWeight: '800' }, description: { marginTop: 10, color: '#68746C', fontSize: 13, lineHeight: 20 },
  form: { marginTop: 28 }, label: { marginBottom: 7, color: '#445047', fontSize: 12, fontWeight: '700' }, input: { height: 50, marginBottom: 17, paddingHorizontal: 14, borderWidth: 1, borderColor: '#CCD6CD', borderRadius: 12, backgroundColor: '#FBFCFB', color: '#17221B', fontSize: 16 }, error: { marginBottom: 14, padding: 11, borderRadius: 9, backgroundColor: '#FFF0EC', color: '#A53D25', fontSize: 12, lineHeight: 18 }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#173F2B' }, buttonPressed: { opacity: 0.85 }, buttonDisabled: { opacity: 0.6 }, buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
})
