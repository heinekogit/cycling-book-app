import { useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'

import type { ElevationProfile } from '@/lib/elevation'

export function ElevationChart({ profile, height = 190, fullWidth = false, onDistanceChange, currentDistanceMeters, currentPositionLabel }: { profile: ElevationProfile; height?: number; fullWidth?: boolean; onDistanceChange?: (distance: number) => void; currentDistanceMeters?: number | null; currentPositionLabel?: string }) {
  const [width, setWidth] = useState(0); const left = fullWidth ? 0 : 40; const right = fullWidth ? 0 : 10; const top = currentDistanceMeters != null ? 28 : 12; const bottom = 25
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)
  if (!width) return <View style={[styles.chart, { minHeight: height }]} onLayout={onLayout} />
  const plotWidth = width - left - right; const plotHeight = height - top - bottom; const minimum = Math.min(0, profile.minimum); const range = Math.max(1, profile.maximum - minimum + 20); const total = profile.distances.at(-1) || 1
  const x = (index: number) => left + plotWidth * profile.distances[index] / total; const y = (value: number) => top + plotHeight - plotHeight * (value - minimum) / range
  const linePoints = profile.elevations.map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`).join(' ')
  const areaPoints = profile.elevations.map((value, index) => `L ${x(index)} ${y(value)}`).join(' ')
  const markerX = currentDistanceMeters != null && Number.isFinite(currentDistanceMeters)
    ? left + plotWidth * Math.max(0, Math.min(total, currentDistanceMeters)) / total
    : null
  const line = linePoints
  const area = `M ${x(0)} ${height - bottom} ${areaPoints} L ${x(profile.elevations.length - 1)} ${height - bottom} Z`
  return <View style={[styles.chart, { minHeight: height }]} onLayout={onLayout}
    onStartShouldSetResponder={() => !!onDistanceChange}
    onMoveShouldSetResponder={() => !!onDistanceChange}
    onResponderTerminationRequest={() => false}
    onResponderGrant={(event) => onDistanceChange?.(Math.max(0, Math.min(1, (event.nativeEvent.locationX - left) / plotWidth)) * total)}
    onResponderMove={(event) => onDistanceChange?.(Math.max(0, Math.min(1, (event.nativeEvent.locationX - left) / plotWidth)) * total)}
  ><Svg pointerEvents="none" width={width} height={height}><Defs><LinearGradient id="elevation" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#2B7950" stopOpacity="0.5" /><Stop offset="1" stopColor="#2B7950" stopOpacity="0.06" /></LinearGradient></Defs>{[0, 1, 2, 3].map((tick) => { const value = minimum + range * tick / 3; return <Path key={tick} d={`M ${left} ${y(value)} L ${width - right} ${y(value)}`} stroke="#DCE5DC" strokeWidth="1" /> })}<Path d={area} fill="url(#elevation)" /><Path d={line} fill="none" stroke="#2B7950" strokeWidth="2.5" />{markerX !== null && <><Path d={`M ${markerX} ${top} L ${markerX} ${height - bottom}`} stroke="#FFF" strokeWidth="5" /><Path d={`M ${markerX} ${top} L ${markerX} ${height - bottom}`} stroke="#EF6D3F" strokeWidth="2.5" /><SvgText x={markerX} y={top - 3} fill="#B74726" fontSize="10" fontWeight="bold" textAnchor={markerX > width - 65 ? 'end' : 'start'}>{currentPositionLabel}</SvgText></>}<SvgText x={left} y={height - 6} fill="#748078" fontSize="10">0 km</SvgText><SvgText x={width - right} y={height - 6} fill="#748078" fontSize="10" textAnchor="end">{(total / 1000).toFixed(1)} km</SvgText></Svg><Text style={styles.range}>{Math.round(profile.minimum)}–{Math.round(profile.maximum)} m</Text></View>
}

const styles = StyleSheet.create({ chart: { width: '100%', marginTop: 12 }, range: { position: 'absolute', top: 6, right: 12, color: '#607067', fontSize: 10, fontWeight: '700' } })
