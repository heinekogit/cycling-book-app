import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Marker } from 'react-native-maps'
import Svg, { Path } from 'react-native-svg'

import { visibleRouteDirectionPoints, type DirectionViewport } from '@/lib/route-direction'
import type { RouteCoordinate } from '@/lib/saved-route-model'

export const ROUTE_LINE_COLOR = '#3B82F6'

export function RouteDirectionArrows({ coordinates, viewport }: { coordinates: RouteCoordinate[]; viewport: DirectionViewport | null }) {
  const arrows = useMemo(() => viewport ? visibleRouteDirectionPoints(coordinates, viewport) : [], [coordinates, viewport])
  return <>{arrows.map((arrow, index) => <Marker
    key={`${index}-${arrow.latitude}-${arrow.longitude}`}
    coordinate={arrow}
    anchor={{ x: .5, y: .5 }}
    tracksViewChanges={false}
    zIndex={5}
  >
    <View pointerEvents="none" style={[styles.arrow, { transform: [{ rotate: `${arrow.rotation}deg` }] }]}>
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Path d="M 4 3 L 10 8 L 4 13" fill="none" stroke="#FFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M 4 3 L 10 8 L 4 13" fill="none" stroke={ROUTE_LINE_COLOR} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  </Marker>)}</>
}

const styles = StyleSheet.create({
  arrow: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
})
