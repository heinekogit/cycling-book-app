import { StyleSheet, View } from 'react-native'
import { Marker } from 'react-native-maps'
import type { RouteSpot } from '@/lib/route-spots'

export function RouteSpotMarker({ spot, onSelect }: { spot: RouteSpot; onSelect: () => void }) {
  if (spot.latitude == null || spot.longitude == null) return null
  const color = spot.id.startsWith('marker:') ? '#d59622' : '#ef6d3f'
  return <Marker coordinate={{ latitude: spot.latitude, longitude: spot.longitude }} anchor={{ x: 0.5, y: 1 }} onPress={(event) => { event.stopPropagation(); onSelect() }}>
    <View style={styles.pinContainer} collapsable={false}><View style={[styles.pin, { backgroundColor: color }]}><View style={styles.dot} /></View></View>
  </Marker>
}

const styles = StyleSheet.create({
  pinContainer: { width: 40, height: 44, alignItems: 'center', paddingTop: 4 },
  pin: { width: 28, height: 28, borderWidth: 3, borderColor: '#fff', borderRadius: 14, borderBottomLeftRadius: 0, transform: [{ rotate: '-45deg' }], alignItems: 'center', justifyContent: 'center', shadowColor: '#173f2b', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
})
