import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { AuthProvider, useAuth } from '@/auth'
import { I18nProvider } from '@/i18n'
import '@/background-location'

export default function RootLayout() {
  return <I18nProvider><AuthProvider><RootNavigator /><StatusBar style="dark" /></AuthProvider></I18nProvider>
}

function RootNavigator() {
  const { session, isLoading } = useAuth()
  if (isLoading) return <View style={styles.loading}><ActivityIndicator color="#173F2B" size="large" /></View>
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!!session}><Stack.Screen name="(app)" /></Stack.Protected>
    <Stack.Protected guard={!session}><Stack.Screen name="sign-in" /></Stack.Protected>
  </Stack>
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7F3' } })
